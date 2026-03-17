import type { CommitteeMember } from "@prisma/client";
import {
	addFormCollaboratorRequestSchema,
	createFormRequestSchema,
	formAuthorizationPathParamsSchema,
	formIdPathParamsSchema,
	formResponsePathParamsSchema,
	requestFormAuthorizationRequestSchema,
	updateFormAuthorizationRequestSchema,
	updateFormDetailRequestSchema,
	updateFormViewersRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { requireDeliverPermission } from "../lib/committee-permission";
import { Errors } from "../lib/error";
import {
	constraintsToPrisma,
	mapFormToApiShape,
	mapItemToApiShape,
} from "../lib/form-constraints";
import {
	notifyFormAuthorizationDecided,
	notifyFormAuthorizationRequested,
} from "../lib/notifications";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeFormRoute = new Hono<AuthEnv>();

// フォームの存在確認 編集権限チェック

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

const userSelect = { id: true, name: true } as const;

/**
 * 回答閲覧権限チェック:
 * 1. owner → 閲覧可
 * 2. 共同編集者 → 閲覧可
 * 3. 閲覧者（FormViewer）にマッチ → 閲覧可
 */
async function canViewFormResponses(
	formId: string,
	userId: string,
	committeeMember: CommitteeMember
): Promise<boolean> {
	const form = await prisma.form.findFirst({
		where: { id: formId, deletedAt: null },
		include: {
			collaborators: { where: { deletedAt: null } },
		},
	});
	if (!form) return false;

	const viewers = await prisma.formViewer.findMany({
		where: { formId, deletedAt: null },
	});

	// 1. owner
	if (form.ownerId === userId) return true;

	// 2. collaborator
	if (form.collaborators.some(c => c.userId === userId)) return true;

	// 3. viewer
	for (const viewer of viewers) {
		if (viewer.scope === "ALL") return true;
		if (
			viewer.scope === "BUREAU" &&
			viewer.bureauValue === committeeMember.Bureau
		)
			return true;
		if (viewer.scope === "INDIVIDUAL" && viewer.userId === userId) return true;
	}

	return false;
}

// 承認時の配信スケジュール日時バリデーション
const validateApprovalSchedule = (
	scheduledSendAt: Date,
	deadlineAt: Date | null | undefined,
	now: Date
) => {
	if (scheduledSendAt <= now) {
		throw Errors.invalidRequest(
			"配信希望日時を過ぎているため承認できません。新しい日時で再申請してください"
		);
	}
	if (deadlineAt && scheduledSendAt >= deadlineAt) {
		throw Errors.invalidRequest(
			"配信希望日時と締め切り日時の順番が不正であるため承認できません。新しい日時で再申請してください"
		);
	}
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
					create: items.map(({ options, constraints, ...item }) => ({
						...item,
						...constraintsToPrisma(constraints),
						options: options?.length ? { create: options } : undefined,
					})),
				},
			},
			include: {
				items: { include: { options: true }, orderBy: { sortOrder: "asc" } },
			},
		});

		return c.json({ form: mapFormToApiShape(form) });
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
						ownerOnly: true,
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
		const { formId } = formIdPathParamsSchema.parse(c.req.param());

		const form = await prisma.form.findFirst({
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

		const viewers = await prisma.formViewer.findMany({
			where: { formId, deletedAt: null },
			include: { user: { select: userSelect } },
		});

		return c.json({
			form: {
				...form,
				items: form.items.map(mapItemToApiShape),
				authorizationDetail: form.authorizations[0] ?? null,
				authorizations: undefined,
				viewers: viewers.map(v => ({
					id: v.id,
					scope: v.scope,
					bureauValue: v.bureauValue,
					createdAt: v.createdAt,
					user: v.user,
				})),
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
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const userId = c.get("user").id;

		await requireWriteAccess(formId, userId);

		const body = await c.req.json().catch(() => ({}));
		const { items, ...formData } = updateFormDetailRequestSchema.parse(body);

		const form = await prisma.$transaction(
			// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: フォーム更新のトランザクション処理
			async tx => {
				const approvedAuth = await tx.formAuthorization.findFirst({
					where: { formId, status: "APPROVED" },
				});
				if (approvedAuth) {
					throw Errors.invalidRequest("配信承認済みのフォームは編集できません");
				}

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

					// 回答が存在するアイテムIDを一括取得
					const answeredItems = await tx.formAnswer.groupBy({
						by: ["formItemId"],
						where: { formItemId: { in: [...existingIds] } },
					});
					const answeredItemIds = new Set(answeredItems.map(a => a.formItemId));

					// 送信されなかったitemは回答があればエラー、なければ物理削除
					const removedIds = [...existingIds].filter(
						id => !submittedIds.has(id)
					);
					const removedWithAnswers = removedIds.filter(id =>
						answeredItemIds.has(id)
					);
					if (removedWithAnswers.length > 0) {
						throw Errors.invalidRequest("回答が存在する項目は削除できません");
					}
					if (removedIds.length > 0) {
						await tx.formItem.deleteMany({
							where: { id: { in: removedIds } },
						});
					}

					// 既存itemを更新 / 新規itemを作成
					for (const [
						index,
						{ id, options, constraints, ...item },
					] of items.entries()) {
						if (id && existingIds.has(id)) {
							if (options && answeredItemIds.has(id)) {
								throw Errors.invalidRequest(
									"回答が存在する項目の選択肢は変更できません"
								);
							}

							await tx.formItem.update({
								where: { id },
								data: {
									...item,
									...constraintsToPrisma(constraints),
									sortOrder: index,
									options: answeredItemIds.has(id)
										? undefined
										: {
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
									...constraintsToPrisma(constraints),
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
						items: {
							include: { options: true },
							orderBy: { sortOrder: "asc" },
						},
					},
				});
			},
			{ isolationLevel: "Serializable" }
		);

		return c.json({ form: mapFormToApiShape(form) });
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
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const userId = c.get("user").id;

		await requireOwner(formId, userId);

		const now = new Date();

		await prisma.$transaction([
			prisma.form.update({
				where: { id: formId },
				data: { deletedAt: now },
			}),
			prisma.formAuthorization.updateMany({
				where: { formId, status: "PENDING" },
				data: { status: "REJECTED", decidedAt: now },
			}),
		]);

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
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const { userId: targetUserId } = c.req.param();
		const userId = c.get("user").id;

		await requireOwner(formId, userId);

		// 自分自身は追加不可
		if (targetUserId === userId) {
			throw Errors.invalidRequest(
				"作成者を共同編集者に追加することはできません"
			);
		}

		// 追加対象ユーザーの存在確認 + 委員会メンバーであることを確認
		const targetUser = await prisma.user.findFirst({
			where: {
				id: targetUserId,
				deletedAt: null,
				committeeMember: { deletedAt: null },
			},
		});
		if (!targetUser)
			throw Errors.notFound(
				"ユーザーが見つからないか、委員会メンバーではありません"
			);

		// 既存チェック（ソフトデリート済みも含めて検索）
		const body = await c.req.json().catch(() => ({}));
		const data = addFormCollaboratorRequestSchema.parse(body);

		const collaborator = await prisma.$transaction(
			async tx => {
				const existing = await tx.formCollaborator.findFirst({
					where: { formId, userId: targetUserId },
				});
				if (existing) {
					if (!existing.deletedAt)
						throw Errors.alreadyExists("既に共同編集者です");

					// ソフトデリート済み → 再有効化
					return tx.formCollaborator.update({
						where: { id: existing.id },
						data: { deletedAt: null, isWrite: data.isWrite },
					});
				}

				return tx.formCollaborator.create({
					data: { formId, userId: targetUserId, isWrite: data.isWrite },
				});
			},
			{ isolationLevel: "Serializable" }
		);

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
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const { userId: targetUserId } = c.req.param();
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
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const user = c.get("user");
		const userId = user.id;

		const form = await requireWriteAccess(formId, userId);

		const body = await c.req.json().catch(() => ({}));
		const { deliveryTarget, requestedToId, ...data } =
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

		// 個別指定モードの場合、配信先企画の存在確認
		if (deliveryTarget.mode === "INDIVIDUAL") {
			const projects = await prisma.project.findMany({
				where: { id: { in: deliveryTarget.projectIds }, deletedAt: null },
			});
			if (projects.length !== deliveryTarget.projectIds.length) {
				throw Errors.notFound("指定された企画の一部が見つかりません");
			}
		}

		const authorization = await prisma.$transaction(
			async tx => {
				const existingAuth = await tx.formAuthorization.findFirst({
					where: { formId, status: { in: ["PENDING", "APPROVED"] } },
				});

				if (existingAuth) {
					if (existingAuth.status === "APPROVED") {
						throw Errors.invalidRequest("このフォームは既に承認されています");
					}
					throw Errors.alreadyExists("既に承認待ちの申請があります");
				}

				if (deliveryTarget.mode === "INDIVIDUAL") {
					return tx.formAuthorization.create({
						data: {
							formId,
							requestedById: userId,
							requestedToId,
							...data,
							deliveryMode: "INDIVIDUAL",
							deliveries: {
								create: deliveryTarget.projectIds.map(projectId => ({
									projectId,
								})),
							},
						},
					});
				}

				// カテゴリ指定モード: フィルタ条件を保存するのみ
				return tx.formAuthorization.create({
					data: {
						formId,
						requestedById: userId,
						requestedToId,
						...data,
						deliveryMode: "CATEGORY",
						filterTypes: deliveryTarget.projectTypes,
						filterLocations: deliveryTarget.projectLocations,
					},
				});
			},
			{ isolationLevel: "Serializable" }
		);

		void notifyFormAuthorizationRequested({
			approverUserId: requestedToId,
			requesterName: user.name,
			formId,
			formTitle: form.title,
			scheduledSendAt: authorization.scheduledSendAt,
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

		const { updated, authorization } = await prisma.$transaction(async tx => {
			const authorization = await tx.formAuthorization.findFirst({
				where: { id: authorizationId, formId },
				include: { form: { select: { deletedAt: true, title: true } } },
			});

			if (!authorization) throw Errors.notFound("承認申請が見つかりません");

			if (authorization.form.deletedAt)
				throw Errors.invalidRequest("削除済みのフォームは承認できません");

			if (authorization.requestedToId !== user.id)
				throw Errors.forbidden("この承認申請を操作する権限がありません");

			if (authorization.status !== "PENDING")
				throw Errors.invalidRequest("この承認申請は既に処理済みです");

			// 承認申請作成後に FORM_DELIVER 権限が剥奪されていないか再確認
			await requireDeliverPermission(
				tx,
				user.id,
				"FORM_DELIVER",
				"フォーム承認権限がありません"
			);

			const now = new Date();
			// 承認する場合、スケジュール日時を検証
			if (status === "APPROVED") {
				validateApprovalSchedule(
					authorization.scheduledSendAt,
					authorization.deadlineAt,
					now
				);
			}

			const updated = await tx.formAuthorization.update({
				where: { id: authorizationId, status: "PENDING" },
				data: { status, decidedAt: new Date() },
			});

			return { updated, authorization };
		});

		void notifyFormAuthorizationDecided({
			requestedByUserId: authorization.requestedById,
			formId,
			formTitle: authorization.form.title,
			status,
			scheduledSendAt: authorization.scheduledSendAt,
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
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const userId = c.get("user").id;
		const committeeMember = c.get("committeeMember");

		// owner, 共同編集者, または閲覧者のみ閲覧可
		if (!(await canViewFormResponses(formId, userId, committeeMember))) {
			throw Errors.forbidden("回答の閲覧権限がありません");
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

		// FormItemEditHistory の最新値を取得
		const formItems = await prisma.formItem.findMany({
			where: { formId },
			select: { id: true },
		});
		const formItemIds = formItems.map(fi => fi.id);
		const projectIds = [
			...new Set(responses.map(r => r.formDelivery.projectId)),
		];

		const allHistory =
			formItemIds.length && projectIds.length
				? await prisma.formItemEditHistory.findMany({
						where: {
							formItemId: { in: formItemIds },
							projectId: { in: projectIds },
						},
						orderBy: { createdAt: "desc" },
						include: {
							selectedOptions: {
								include: {
									formItemOption: { select: { id: true, label: true } },
								},
							},
						},
					})
				: [];

		const latestByCell = new Map<string, (typeof allHistory)[0]>();
		for (const h of allHistory) {
			const key = `${h.formItemId}:${h.projectId}`;
			if (!latestByCell.has(key)) latestByCell.set(key, h);
		}

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
				answers: r.answers.map(a => {
					const history = latestByCell.get(
						`${a.formItemId}:${r.formDelivery.projectId}`
					);
					if (history) {
						return {
							formItemId: a.formItemId,
							textValue: history.textValue,
							numberValue: history.numberValue,
							fileId: history.fileId,
							selectedOptions: history.selectedOptions.map(s => ({
								id: s.formItemOption.id,
								label: s.formItemOption.label,
							})),
						};
					}
					return {
						formItemId: a.formItemId,
						textValue: a.textValue,
						numberValue: a.numberValue,
						fileId: a.fileId,
						selectedOptions: a.selectedOptions.map(s => ({
							id: s.formItemOption.id,
							label: s.formItemOption.label,
						})),
					};
				}),
			})),
		});
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/forms/:formId/responses/:responseId
// 回答詳細（owner または共同編集者のみ）
// ─────────────────────────────────────────────────────────────
committeeFormRoute.get(
	"/:formId/responses/:responseId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId, responseId } = formResponsePathParamsSchema.parse(
			c.req.param()
		);
		const userId = c.get("user").id;
		const committeeMember = c.get("committeeMember");

		// owner, 共同編集者, または閲覧者のみ閲覧可
		if (!(await canViewFormResponses(formId, userId, committeeMember))) {
			throw Errors.forbidden("回答の閲覧権限がありません");
		}

		const r = await prisma.formResponse.findFirst({
			where: {
				id: responseId,
				formDelivery: { formAuthorization: { formId } },
				submittedAt: { not: null },
			},
			include: {
				respondent: { select: { id: true, name: true } },
				formDelivery: {
					include: {
						project: { select: { id: true, number: true, name: true } },
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
		});
		if (!r) throw Errors.notFound("回答が見つかりません");

		// FormItemEditHistory の最新値を取得
		const formItemIds = r.answers.map(a => a.formItemId);
		const projectId = r.formDelivery.project.id;
		const allHistory = formItemIds.length
			? await prisma.formItemEditHistory.findMany({
					where: {
						formItemId: { in: formItemIds },
						projectId,
					},
					orderBy: { createdAt: "desc" },
					include: {
						selectedOptions: {
							include: {
								formItemOption: { select: { id: true, label: true } },
							},
						},
					},
				})
			: [];

		const latestByItem = new Map<string, (typeof allHistory)[0]>();
		for (const h of allHistory) {
			if (!latestByItem.has(h.formItemId)) latestByItem.set(h.formItemId, h);
		}
		const fileIds = [
			...r.answers.map(answer => answer.fileId),
			...allHistory.map(history => history.fileId),
		].filter((id): id is string => Boolean(id));
		const fileMap = new Map(
			(
				await prisma.file.findMany({
					where: {
						id: { in: [...new Set(fileIds)] },
						status: "CONFIRMED",
						deletedAt: null,
					},
					select: {
						id: true,
						fileName: true,
						mimeType: true,
						size: true,
						isPublic: true,
					},
				})
			).map(file => [file.id, file])
		);

		return c.json({
			response: {
				id: r.id,
				respondent: r.respondent,
				project: {
					id: r.formDelivery.project.id,
					number: r.formDelivery.project.number,
					name: r.formDelivery.project.name,
				},
				submittedAt: r.submittedAt,
				createdAt: r.createdAt,
				answers: r.answers.map(a => {
					const history = latestByItem.get(a.formItemId);
					if (history) {
						return {
							formItemId: a.formItemId,
							textValue: history.textValue,
							numberValue: history.numberValue,
							fileId: history.fileId,
							fileMetadata: history.fileId
								? (fileMap.get(history.fileId) ?? null)
								: null,
							selectedOptions: history.selectedOptions.map(s => ({
								id: s.formItemOption.id,
								label: s.formItemOption.label,
							})),
						};
					}
					return {
						formItemId: a.formItemId,
						textValue: a.textValue,
						numberValue: a.numberValue,
						fileId: a.fileId,
						fileMetadata: a.fileId ? (fileMap.get(a.fileId) ?? null) : null,
						selectedOptions: a.selectedOptions.map(s => ({
							id: s.formItemOption.id,
							label: s.formItemOption.label,
						})),
					};
				}),
			},
		});
	}
);

// ─────────────────────────────────────────────────────────────
// PUT /committee/forms/:formId/viewers
// 閲覧者設定（作成者 or 書き込み権限付き共同編集者のみ）
// 既存の閲覧者を全削除して新規作成
// ─────────────────────────────────────────────────────────────
committeeFormRoute.put(
	"/:formId/viewers",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const userId = c.get("user").id;

		await requireWriteAccess(formId, userId);

		const body = await c.req.json().catch(() => ({}));
		const { viewers: viewerInputs } =
			updateFormViewersRequestSchema.parse(body);

		// トランザクションで全削除→新規作成
		const viewers = await prisma.$transaction(async tx => {
			await tx.formViewer.deleteMany({ where: { formId } });

			const created = await Promise.all(
				viewerInputs.map(input =>
					tx.formViewer.create({
						data: {
							formId,
							scope: input.scope,
							bureauValue: input.bureauValue ?? null,
							userId: input.userId ?? null,
						},
						include: { user: { select: userSelect } },
					})
				)
			);

			return created;
		});

		return c.json({
			viewers: viewers.map(v => ({
				id: v.id,
				scope: v.scope,
				bureauValue: v.bureauValue,
				createdAt: v.createdAt,
				user: v.user,
			})),
		});
	}
);

export { committeeFormRoute };
