import {
	addFormCollaboratorRequestSchema,
	createFormRequestSchema,
	formAuthorizationPathParamsSchema,
	requestFormAuthorizationRequestSchema,
	updateFormAuthorizationRequestSchema,
	updateFormDetailRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeFormRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// ヘルパー: フォームの存在確認 編集権限チェック
// ─────────────────────────────────────────────────────────────

const getFormOrThrow = async (formId: string) => {
	const form = await prisma.form.findFirst({
		where: { id: formId, deletedAt: null },
		include: {
			items: { include: { options: true }, orderBy: { sortOrder: "asc" } },
		},
	});
	if (!form) throw Errors.notFound("フォームが見つかりません");
	return form;
};

// 作成者 or 書き込み権限付き共同編集者
const requireWriteAccess = async (formId: string, userId: string) => {
	const form = await getFormOrThrow(formId);

	if (form.ownerId === userId) return form;

	const collaborator = await prisma.formCollaborator.findFirst({
		where: { formId, userId, isWrite: true, deletedAt: null },
	});
	if (!collaborator) throw Errors.forbidden("編集権限がありません");

	return form;
};

// 作成者のみ
const requireOwner = async (formId: string, userId: string) => {
	const form = await getFormOrThrow(formId);
	if (form.ownerId !== userId)
		throw Errors.forbidden("この操作は作成者のみ行えます");
	return form;
};

// ─────────────────────────────────────────
// POST /committee/forms/create
// フォームを作成（項目・選択肢含め一括登録）
// ─────────────────────────────────────────
committeeFormRoute.post(
	"/create",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const body = await c.req.json().catch(() => ({}));
		const { items, ...formData } = createFormRequestSchema.parse(body);
		const userId = c.get("user").id;

		const form = await prisma.form.create({
			data: {
				...formData,
				ownerId: userId,
				items: {
					create: items.map(({ options, ...item }) => ({
						...item,
						options: options?.length ? { create: options } : undefined,
					})),
				},
			},
			include: {
				items: { include: { options: true }, orderBy: { sortOrder: "asc" } },
			},
		});

		return c.json({ form });
	}
);

// ─────────────────────────────────────────
// GET /committee/forms/list
// フォーム一覧を取得（実委人全員閲覧可）
// ─────────────────────────────────────────
committeeFormRoute.get(
	"/list",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const forms = await prisma.form.findMany({
			where: { deletedAt: null },
			select: {
				id: true,
				title: true,
				description: true,
				updatedAt: true,
				owner: {
					select: { id: true, name: true },
				},
				collaborators: {
					where: { deletedAt: null },
					select: {
						user: { select: { id: true, name: true } },
					},
				},
				authorizations: {
					orderBy: { createdAt: "desc" },
					take: 1,
					select: {
						id: true,
						status: true,
						scheduledSendAt: true,
						allowLateResponse: true,
						deadlineAt: true,
						requestedTo: {
							select: { id: true, name: true },
						},
					},
				},
			},
			orderBy: { updatedAt: "desc" },
		});

		return c.json({
			forms: forms.map(f => ({
				...f,
				collaborators: f.collaborators.map(c => c.user),
				authorization: f.authorizations[0] ?? null,
				authorizations: undefined,
			})),
		});
	}
);

// ─────────────────────────────────────────
// GET /committee/forms/:formId/detail
// フォームの詳細を取得（項目含む）
// ─────────────────────────────────────────
committeeFormRoute.get(
	"/:formId/detail",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = c.req.param();

		const form = await prisma.form.findUniqueOrThrow({
			where: { id: formId, deletedAt: null },
			include: {
				owner: { select: { id: true, name: true } },
				items: {
					include: {
						options: true,
					},
					orderBy: { sortOrder: "asc" },
				},
				collaborators: {
					where: { deletedAt: null },
					include: {
						user: { select: { id: true, name: true } },
					},
				},
				authorizations: {
					orderBy: { createdAt: "desc" },
					take: 1,
					include: {
						requestedBy: { select: { id: true, name: true } },
						requestedTo: { select: { id: true, name: true } },
						deliveries: {
							include: {
								project: { select: { id: true, name: true } },
							},
						},
					},
				},
			},
		});

		if (!form) {
			throw Errors.notFound("フォームが見つかりません");
		}

		return c.json({
			form: {
				...form,
				authorizationDetail: form.authorizations[0] ?? null,
				authorizations: undefined,
			},
		});
	}
);

// ─────────────────────────────────────────
// PATCH /committee/forms/:formId/detail
// フォームを更新
// ─────────────────────────────────────────
committeeFormRoute.patch(
	"/:formId/detail",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = c.req.param();
		const userId = c.get("user").id;

		await requireWriteAccess(formId, userId);

		const approvedAuth = await prisma.formAuthorization.findFirst({
			where: { formId, status: "APPROVED" },
		});
		if (approvedAuth) {
			throw Errors.invalidRequest("配信承認済みのフォームは編集できません");
		}

		const body = await c.req.json().catch(() => ({}));
		const { items, ...formData } = updateFormDetailRequestSchema.parse(body);

		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: items の CRUD を一括で行うため
		const form = await prisma.$transaction(async tx => {
			await tx.form.update({ where: { id: formId }, data: formData });

			if (items !== undefined) {
				const existingItems = await tx.formItem.findMany({
					where: { formId },
					select: { id: true },
				});

				const existingIds = new Set(existingItems.map(i => i.id));
				const submittedIds = new Set(
					items.flatMap(i => (i.id && existingIds.has(i.id) ? [i.id] : []))
				);

				// 送信されなかったitemは回答があればエラー、なければ物理削除
				const removedIds = [...existingIds].filter(id => !submittedIds.has(id));
				for (const id of removedIds) {
					const hasAnswers = await tx.formAnswer.count({
						where: { formItemId: id },
					});
					if (hasAnswers > 0) {
						throw Errors.invalidRequest("回答が存在する項目は削除できません");
					}
					await tx.formItem.delete({ where: { id } });
				}

				// 既存itemを更新 / 新規itemを作成
				for (const [index, { id, options, ...item }] of items.entries()) {
					if (id && existingIds.has(id)) {
						await tx.formItem.update({
							where: { id },
							data: {
								...item,
								sortOrder: index,
								options: {
									deleteMany: {},
									create: (options ?? []).map((opt, i) => ({
										label: opt.label,
										sortOrder: i,
									})),
								},
							},
						});
					} else {
						await tx.formItem.create({
							data: {
								...item,
								formId,
								sortOrder: index,
								options: options?.length
									? {
											create: options.map((opt, i) => ({
												label: opt.label,
												sortOrder: i,
											})),
										}
									: undefined,
							},
						});
					}
				}
			}

			return tx.form.findUniqueOrThrow({
				where: { id: formId },
				include: {
					items: { include: { options: true }, orderBy: { sortOrder: "asc" } },
				},
			});
		});

		return c.json({ form });
	}
);

// ─────────────────────────────────────────
// DELETE /committee/forms/:formId
// フォームを論理削除
// ─────────────────────────────────────────
committeeFormRoute.delete(
	"/:formId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = c.req.param();
		const userId = c.get("user").id;

		await requireOwner(formId, userId);

		await prisma.form.update({
			where: { id: formId },
			data: { deletedAt: new Date() },
		});

		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────────────────────────
// 共同編集者
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────
// POST /committee/forms/:formId/collaborators/:userId
// 共同編集者を追加
// ─────────────────────────────────────────
committeeFormRoute.post(
	"/:formId/collaborators/:userId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId, userId: targetUserId } = c.req.param();
		const userId = c.get("user").id;

		await requireOwner(formId, userId);

		// 自分自身は追加不可
		if (targetUserId === userId) {
			throw Errors.invalidRequest(
				"作成者を共同編集者に追加することはできません"
			);
		}

		// 追加対象ユーザーの存在確認
		const targetUser = await prisma.user.findFirst({
			where: { id: targetUserId, deletedAt: null },
		});
		if (!targetUser) throw Errors.notFound("ユーザーが見つかりません");

		// 既存チェック（ソフトデリート済みも含めて検索）
		const existing = await prisma.formCollaborator.findFirst({
			where: { formId, userId: targetUserId },
		});
		if (existing) {
			if (!existing.deletedAt) {
				throw Errors.alreadyExists("既に共同編集者です");
			}

			// ソフトデリート済み → 再有効化
			const reactivated = await prisma.formCollaborator.update({
				where: { id: existing.id },
				data: { deletedAt: null },
			});

			return c.json({ collaborator: reactivated });
		}

		const body = await c.req.json().catch(() => ({}));
		const data = addFormCollaboratorRequestSchema.parse(body);

		const collaborator = await prisma.formCollaborator.create({
			data: {
				formId,
				userId: targetUserId,
				isWrite: data.isWrite,
			},
		});

		return c.json({ collaborator });
	}
);

// ─────────────────────────────────────────
// DELETE /committee/forms/:formId/collaborators/:userId
// 共同編集者を削除
// ─────────────────────────────────────────
committeeFormRoute.delete(
	"/:formId/collaborators/:userId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId, userId: targetUserId } = c.req.param();
		const userId = c.get("user").id;

		await requireOwner(formId, userId);

		const collaborator = await prisma.formCollaborator.findFirst({
			where: { formId, userId: targetUserId, deletedAt: null },
		});
		if (!collaborator)
			throw Errors.notFound("対象ユーザーは共同編集者ではありません");

		await prisma.formCollaborator.update({
			where: { id: collaborator.id },
			data: { deletedAt: new Date() },
		});

		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────────────────────────
// 承認フロー
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────
// POST /committee/forms/:formId/authorizations
// 配信承認をリクエスト
// ─────────────────────────────────────────
committeeFormRoute.post(
	"/:formId/authorizations",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = c.req.param();
		const userId = c.get("user").id;

		await requireWriteAccess(formId, userId);

		const body = await c.req.json().catch(() => ({}));
		const { projectIds, requestedToId, ...data } =
			requestFormAuthorizationRequestSchema.parse(body);

		// 承認依頼先ユーザーの存在確認
		const requestedTo = await prisma.user.findFirst({
			where: { id: requestedToId, deletedAt: null },
		});
		if (!requestedTo)
			throw Errors.notFound("承認依頼先のユーザーが見つかりません");

		// 承認依頼先が実委人かつ FORM_DELIVER 権限を持っているか確認
		const committeeMember = await prisma.committeeMember.findFirst({
			where: {
				userId: requestedToId,
				deletedAt: null,
				permissions: {
					some: { permission: "FORM_DELIVER" },
				},
			},
		});
		if (!committeeMember) {
			throw Errors.invalidRequest(
				"承認依頼先のユーザーにフォーム配信権限がありません"
			);
		}

		const now = new Date();
		// scheduledSendAt が未来であること
		if (data.scheduledSendAt && data.scheduledSendAt <= now) {
			throw Errors.invalidRequest("配信希望日時は未来の日時を指定してください");
		} else if (data.deadlineAt && data.scheduledSendAt >= data.deadlineAt) {
			throw Errors.invalidRequest("配信希望日時と締め切り日時の順番が不正です");
		}

		// 配信先企画の存在確認
		const projects = await prisma.project.findMany({
			where: { id: { in: projectIds }, deletedAt: null },
		});
		if (projects.length !== projectIds.length) {
			throw Errors.notFound("指定された企画の一部が見つかりません");
		}

		const authorization = await prisma.formAuthorization.create({
			data: {
				formId,
				requestedById: userId,
				requestedToId,
				...data,
				deliveries: {
					create: projectIds.map(projectId => ({ projectId })),
				},
			},
		});

		return c.json({ authorization });
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /committee/forms/:formId/authorizations/:authorizationId
// 承認 / 却下（requestedTo 本人のみ）
// ─────────────────────────────────────────────────────────────
committeeFormRoute.patch(
	"/:formId/authorizations/:authorizationId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { formId, authorizationId } = formAuthorizationPathParamsSchema.parse(
			{
				formId: c.req.param("formId"),
				authorizationId: c.req.param("authorizationId"),
			}
		);
		const body = await c.req.json().catch(() => ({}));
		const { status } = updateFormAuthorizationRequestSchema.parse(body);

		const authorization = await prisma.formAuthorization.findFirst({
			where: { id: authorizationId, formId },
			include: { form: { select: { deletedAt: true } } },
		});

		if (!authorization) {
			throw Errors.notFound("承認申請が見つかりません");
		}

		if (authorization.form.deletedAt) {
			throw Errors.invalidRequest("削除済みのフォームは承認できません");
		}

		if (authorization.requestedToId !== user.id) {
			throw Errors.forbidden("この承認申請を操作する権限がありません");
		}

		if (authorization.status !== "PENDING") {
			throw Errors.invalidRequest("この承認申請は既に処理済みです");
		}

		const now = new Date();
		// 承認する場合、scheduledSendAt が未来であること
		if (status === "APPROVED" && authorization.scheduledSendAt <= now) {
			throw Errors.invalidRequest(
				"配信希望日時を過ぎているため承認できません。新しい日時で再申請してください"
			);
		} else if (
			status === "APPROVED" &&
			authorization.deadlineAt &&
			authorization.scheduledSendAt >= authorization.deadlineAt
		) {
			throw Errors.invalidRequest(
				"配信希望日時と締め切り日時の順番が不正であるため承認できません。新しい日時で再申請してください"
			);
		}

		const updated = await prisma.formAuthorization.update({
			where: { id: authorizationId, status: "PENDING" },
			data: { status, decidedAt: new Date() },
		});

		return c.json({ authorization: updated });
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/forms/:formId/responses
// 回答一覧（owner または共同編集者のみ）
// ─────────────────────────────────────────────────────────────
committeeFormRoute.get(
	"/:formId/responses",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = c.req.param();
		const userId = c.get("user").id;

		// owner または共同編集者のみ閲覧可
		const form = await prisma.form.findFirst({
			where: { id: formId, deletedAt: null },
			include: {
				collaborators: { where: { deletedAt: null } },
			},
		});
		if (!form) throw Errors.notFound("フォームが見つかりません");

		const isOwner = form.ownerId === userId;
		const isCollaborator = form.collaborators.some(c => c.userId === userId);
		if (!isOwner && !isCollaborator) {
			throw Errors.forbidden("回答の閲覧は作成者・共同編集者のみ可能です");
		}

		const responses = await prisma.formResponse.findMany({
			where: {
				formDelivery: { formAuthorization: { formId } },
				submittedAt: { not: null }, // 提出済みのみ
			},
			include: {
				respondent: { select: { id: true, name: true } },
				formDelivery: {
					include: {
						project: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
				answers: {
					include: {
						selectedOptions: {
							include: {
								formItemOption: { select: { id: true, label: true } },
							},
						},
					},
				},
			},
			orderBy: { submittedAt: "desc" },
		});

		return c.json({
			responses: responses.map(r => ({
				id: r.id,
				respondent: r.respondent,
				project: {
					id: r.formDelivery.project.id,
					name: r.formDelivery.project.name,
				},
				submittedAt: r.submittedAt,
				createdAt: r.createdAt,
				answers: r.answers.map(a => ({
					formItemId: a.formItemId,
					textValue: a.textValue,
					numberValue: a.numberValue,
					fileUrl: a.fileUrl,
					selectedOptions: a.selectedOptions.map(s => ({
						id: s.formItemOption.id,
						label: s.formItemOption.label,
					})),
				})),
			})),
		});
	}
);

export { committeeFormRoute };
