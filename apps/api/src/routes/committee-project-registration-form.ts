import {
	addProjectRegistrationFormCollaboratorRequestSchema,
	createProjectRegistrationFormRequestSchema,
	projectRegistrationFormAuthorizationPathParamsSchema,
	projectRegistrationFormCollaboratorPathParamsSchema,
	projectRegistrationFormIdPathParamsSchema,
	requestProjectRegistrationFormAuthorizationRequestSchema,
	updateProjectRegistrationFormAuthorizationRequestSchema,
	updateProjectRegistrationFormRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { requireDeliverPermission } from "../lib/committee-permission";
import { Errors } from "../lib/error";
import {
	constraintsToPrisma,
	mapFormToApiShape,
} from "../lib/form-constraints";
import {
	notifyProjectRegistrationFormAuthorizationDecided,
	notifyProjectRegistrationFormAuthorizationRequested,
} from "../lib/notifications";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeProjectRegistrationFormRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────────────────────

const getFormOrThrow = async (formId: string) => {
	const form = await prisma.projectRegistrationForm.findFirst({
		where: { id: formId, deletedAt: null },
		include: {
			owner: { select: { id: true, name: true } },
			items: {
				include: { options: { orderBy: { sortOrder: "asc" } } },
				orderBy: { sortOrder: "asc" },
			},
			authorizations: {
				include: {
					requestedBy: true,
					requestedTo: true,
				},
				orderBy: { createdAt: "desc" },
			},
			collaborators: {
				where: { deletedAt: null },
				include: { user: { select: { id: true, name: true } } },
			},
		},
	});
	if (!form) throw Errors.notFound("企画登録フォームが見つかりません");
	return form;
};

// 作成者のみ許可
const requireOwner = async (formId: string, userId: string) => {
	const form = await getFormOrThrow(formId);
	if (form.ownerId !== userId)
		throw Errors.forbidden("この操作は作成者のみ行えます");
	return form;
};

// PROJECT_REGISTRATION_FORM_CREATE 権限チェック
const requireCreatePermission = async (committeeMemberId: string) => {
	const cm = await prisma.committeeMember.findUnique({
		where: { id: committeeMemberId },
		include: { permissions: true },
	});
	if (!cm) throw Errors.forbidden("実委メンバーではありません");
	if (
		cm.permissions.some(
			p => p.permission === "PROJECT_REGISTRATION_FORM_CREATE"
		)
	) {
		return;
	}
	throw Errors.forbidden("企画登録フォームを作成・編集する権限がありません");
};

// ─────────────────────────────────────────
// POST /committee/project-registration-forms/create
// 企画登録フォームを作成
// ─────────────────────────────────────────
committeeProjectRegistrationFormRoute.post(
	"/create",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const cm = c.get("committeeMember");
		await requireCreatePermission(cm.id);

		const body = await c.req.json().catch(() => ({}));
		const { items, ...formData } =
			createProjectRegistrationFormRequestSchema.parse(body);
		const userId = c.get("user").id;

		const form = await prisma.$transaction(
			async tx => {
				// sortOrder を有効範囲 [0, 総数] に丸める
				const totalCount = await tx.projectRegistrationForm.count({
					where: { deletedAt: null },
				});
				const clampedSortOrder = Math.min(
					Math.max(formData.sortOrder, 0),
					totalCount
				);

				// 指定位置以降のフォームを +1 シフトして挿入スペースを確保
				await tx.projectRegistrationForm.updateMany({
					where: { sortOrder: { gte: clampedSortOrder }, deletedAt: null },
					data: { sortOrder: { increment: 1 } },
				});

				return tx.projectRegistrationForm.create({
					data: {
						...formData,
						sortOrder: clampedSortOrder,
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
						owner: { select: { id: true, name: true } },
						items: {
							include: { options: { orderBy: { sortOrder: "asc" } } },
							orderBy: { sortOrder: "asc" },
						},
						authorizations: {
							include: { requestedBy: true, requestedTo: true },
						},
						collaborators: {
							where: { deletedAt: null },
							include: { user: { select: { id: true, name: true } } },
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
// GET /committee/project-registration-forms
// 企画登録フォーム一覧（実委人全員閲覧可）
// ─────────────────────────────────────────
committeeProjectRegistrationFormRoute.get(
	"/",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const forms = await prisma.projectRegistrationForm.findMany({
			where: { deletedAt: null },
			include: {
				owner: { select: { id: true, name: true } },
				authorizations: {
					orderBy: { createdAt: "desc" },
					take: 1,
				},
			},
			orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
		});

		return c.json({
			forms: forms.map(f => {
				const { authorizations, ...rest } = f;
				return {
					...rest,
					latestAuthorization: authorizations[0] ?? null,
				};
			}),
		});
	}
);

// ─────────────────────────────────────────
// GET /committee/project-registration-forms/:formId
// 企画登録フォーム詳細（実委人全員閲覧可）
// ─────────────────────────────────────────
committeeProjectRegistrationFormRoute.get(
	"/:formId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = projectRegistrationFormIdPathParamsSchema.parse(
			c.req.param()
		);
		const form = await getFormOrThrow(formId);
		return c.json({ form: mapFormToApiShape(form) });
	}
);

// ─────────────────────────────────────────
// PATCH /committee/project-registration-forms/:formId
// 企画登録フォームを更新（作成者 + CREATE権限）
// ─────────────────────────────────────────
committeeProjectRegistrationFormRoute.patch(
	"/:formId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const cm = c.get("committeeMember");
		await requireCreatePermission(cm.id);

		const { formId } = projectRegistrationFormIdPathParamsSchema.parse(
			c.req.param()
		);
		const userId = c.get("user").id;

		const body = await c.req.json().catch(() => ({}));
		const { items, ...formDataParsed } =
			updateProjectRegistrationFormRequestSchema.parse(body);
		let formData = formDataParsed;

		const form = await prisma.$transaction(
			// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: フォーム更新のトランザクション処理
			async tx => {
				const existing = await tx.projectRegistrationForm.findFirstOrThrow({
					where: { id: formId, deletedAt: null },
					select: {
						ownerId: true,
						sortOrder: true,
						isActive: true,
						filterTypes: true,
						filterLocations: true,
						collaborators: {
							where: { deletedAt: null },
							select: { userId: true, isWrite: true },
						},
					},
				});

				// 作成者または書き込み権限を持つ共同編集者のみ許可
				const hasWriteAccess =
					existing.ownerId === userId ||
					existing.collaborators.some(c => c.userId === userId && c.isWrite);
				if (!hasWriteAccess)
					throw Errors.forbidden(
						"この操作は作成者または共同編集者のみ行えます"
					);

				if (existing.isActive)
					throw Errors.invalidRequest("有効化されたフォームは変更できません");

				// filterTypes/filterLocations 整合性チェック
				{
					const mergedTypes = formData.filterTypes ?? existing.filterTypes;
					const mergedLocations =
						formData.filterLocations ?? existing.filterLocations;
					const hasStage = mergedTypes.includes("STAGE");
					const hasNonStage = mergedTypes.some(t => t !== "STAGE");
					if (
						hasStage &&
						!hasNonStage &&
						!mergedLocations.every(l => l === "STAGE")
					) {
						throw Errors.invalidRequest(
							"ステージ企画区分の場合、実施場所はステージのみ指定できます"
						);
					}
					if (!hasStage && hasNonStage && mergedLocations.includes("STAGE")) {
						throw Errors.invalidRequest(
							"ステージ以外の企画区分の場合、実施場所にステージは指定できません"
						);
					}
				}

				// sortOrder が変更される場合は既存フォームをシフト
				if (
					formData.sortOrder !== undefined &&
					formData.sortOrder !== existing.sortOrder
				) {
					const oldOrder = existing.sortOrder;
					// sortOrder を有効範囲 [0, 総数-1] に丸める
					const totalCount = await tx.projectRegistrationForm.count({
						where: { deletedAt: null },
					});
					const newOrder = Math.min(
						Math.max(formData.sortOrder, 0),
						totalCount - 1
					);
					formData = { ...formData, sortOrder: newOrder };
					if (newOrder === oldOrder) {
						// clamp後に変化なし: シフト不要
					} else if (newOrder < oldOrder) {
						// 上に移動: [newOrder, oldOrder) の範囲を +1
						await tx.projectRegistrationForm.updateMany({
							where: {
								id: { not: formId },
								sortOrder: { gte: newOrder, lt: oldOrder },
								deletedAt: null,
							},
							data: { sortOrder: { increment: 1 } },
						});
					} else {
						// 下に移動: (oldOrder, newOrder] の範囲を -1
						await tx.projectRegistrationForm.updateMany({
							where: {
								id: { not: formId },
								sortOrder: { gt: oldOrder, lte: newOrder },
								deletedAt: null,
							},
							data: { sortOrder: { decrement: 1 } },
						});
					}
				}

				await tx.projectRegistrationForm.update({
					where: { id: formId },
					data: { ...formData },
				});

				if (items !== undefined) {
					// 既存回答がある場合は設問の変更を禁止（データ整合性の保護）
					const responseCount = await tx.projectRegistrationFormResponse.count({
						where: { formId },
					});
					if (responseCount > 0)
						throw Errors.invalidRequest(
							"回答が存在するフォームの設問は変更できません"
						);

					// 既存の items を全削除して再作成
					await tx.projectRegistrationFormItem.deleteMany({
						where: { formId },
					});
					await Promise.all(
						items.map(({ options, constraints, ...item }) =>
							tx.projectRegistrationFormItem.create({
								data: {
									...item,
									...constraintsToPrisma(constraints),
									formId,
									options: options?.length ? { create: options } : undefined,
								},
							})
						)
					);
				}

				return tx.projectRegistrationForm.findUniqueOrThrow({
					where: { id: formId },
					include: {
						owner: { select: { id: true, name: true } },
						items: {
							include: { options: { orderBy: { sortOrder: "asc" } } },
							orderBy: { sortOrder: "asc" },
						},
						authorizations: {
							include: { requestedBy: true, requestedTo: true },
							orderBy: { createdAt: "desc" },
						},
						collaborators: {
							where: { deletedAt: null },
							include: { user: { select: { id: true, name: true } } },
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
// DELETE /committee/project-registration-forms/:formId
// 企画登録フォームを論理削除（作成者 + CREATE権限）
// ─────────────────────────────────────────
committeeProjectRegistrationFormRoute.delete(
	"/:formId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const cm = c.get("committeeMember");
		await requireCreatePermission(cm.id);

		const { formId } = projectRegistrationFormIdPathParamsSchema.parse(
			c.req.param()
		);
		const userId = c.get("user").id;

		const now = new Date();
		await prisma.$transaction(
			async tx => {
				const current = await tx.projectRegistrationForm.findFirst({
					where: { id: formId, deletedAt: null },
					select: { ownerId: true, isActive: true, sortOrder: true },
				});
				if (!current) throw Errors.notFound("企画登録フォームが見つかりません");
				if (current.ownerId !== userId)
					throw Errors.forbidden("この操作は作成者のみ行えます");
				if (current.isActive)
					throw Errors.invalidRequest("有効化されたフォームは削除できません");

				await tx.projectRegistrationForm.update({
					where: { id: formId },
					data: { deletedAt: now, isActive: false },
				});
				await tx.projectRegistrationFormAuthorization.updateMany({
					where: { formId, status: "PENDING" },
					data: { status: "REJECTED", decidedAt: now },
				});
				// 削除後の空き番を詰める
				await tx.projectRegistrationForm.updateMany({
					where: { sortOrder: { gt: current.sortOrder }, deletedAt: null },
					data: { sortOrder: { decrement: 1 } },
				});
			},
			{ isolationLevel: "Serializable" }
		);

		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────
// POST /committee/project-registration-forms/:formId/authorizations
// 承認申請（作成者 + CREATE権限）
// ─────────────────────────────────────────
committeeProjectRegistrationFormRoute.post(
	"/:formId/authorizations",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const cm = c.get("committeeMember");
		await requireCreatePermission(cm.id);

		const { formId } = projectRegistrationFormIdPathParamsSchema.parse(
			c.req.param()
		);
		const userId = c.get("user").id;
		const form = await requireOwner(formId, userId);

		const body = await c.req.json().catch(() => ({}));
		const { requestedToId } =
			requestProjectRegistrationFormAuthorizationRequestSchema.parse(body);

		// 承認依頼先ユーザーの存在確認
		const requestedTo = await prisma.user.findFirst({
			where: { id: requestedToId, deletedAt: null },
		});
		if (!requestedTo)
			throw Errors.notFound("承認依頼先のユーザーが見つかりません");

		// PROJECT_REGISTRATION_FORM_DELIVER 権限または委員長であることを確認
		await requireDeliverPermission(
			prisma,
			requestedToId,
			"PROJECT_REGISTRATION_FORM_DELIVER",
			"承認依頼先のユーザーに企画登録フォーム承認権限がありません",
			"invalidRequest"
		);

		const authorization = await prisma.$transaction(
			async tx => {
				// 既に PENDING / APPROVED の申請がないか確認
				const existing =
					await tx.projectRegistrationFormAuthorization.findFirst({
						where: { formId, status: { in: ["PENDING", "APPROVED"] } },
					});
				if (existing) {
					if (existing.status === "APPROVED") {
						throw Errors.invalidRequest("このフォームは既に承認されています");
					}
					throw Errors.alreadyExists("既に承認待ちの申請があります");
				}

				return tx.projectRegistrationFormAuthorization.create({
					data: {
						formId,
						requestedById: userId,
						requestedToId,
					},
				});
			},
			{ isolationLevel: "Serializable" }
		);

		void notifyProjectRegistrationFormAuthorizationRequested({
			approverUserId: requestedToId,
			requesterName: c.get("user").name,
			formId,
			formTitle: form.title,
		});

		return c.json({ authorization });
	}
);

// ─────────────────────────────────────────
// PATCH /committee/project-registration-forms/:formId/authorizations/:authorizationId
// 承認 / 却下（requestedTo 本人 + DELIVER権限）
// ─────────────────────────────────────────
committeeProjectRegistrationFormRoute.patch(
	"/:formId/authorizations/:authorizationId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { formId, authorizationId } =
			projectRegistrationFormAuthorizationPathParamsSchema.parse({
				formId: c.req.param("formId"),
				authorizationId: c.req.param("authorizationId"),
			});

		const body = await c.req.json().catch(() => ({}));
		const { status } =
			updateProjectRegistrationFormAuthorizationRequestSchema.parse(body);

		const authorization = await prisma.$transaction(
			async tx => {
				const auth = await tx.projectRegistrationFormAuthorization.findFirst({
					where: { id: authorizationId, formId },
					include: {
						form: { select: { deletedAt: true, title: true } },
					},
				});

				if (!auth) throw Errors.notFound("承認申請が見つかりません");
				if (auth.form.deletedAt)
					throw Errors.invalidRequest("削除済みのフォームは承認できません");
				if (auth.requestedToId !== user.id)
					throw Errors.forbidden("この承認申請を操作する権限がありません");
				if (auth.status !== "PENDING")
					throw Errors.invalidRequest("この承認申請は既に処理済みです");

				// 承認申請作成後に DELIVER 権限が剥奪されていないか再確認
				await requireDeliverPermission(
					tx,
					user.id,
					"PROJECT_REGISTRATION_FORM_DELIVER",
					"企画登録フォーム承認権限がありません"
				);

				const updated = await tx.projectRegistrationFormAuthorization.update({
					where: { id: authorizationId, status: "PENDING" },
					data: { status, decidedAt: new Date() },
				});

				// 承認された場合、フォームを有効化
				if (status === "APPROVED") {
					await tx.projectRegistrationForm.update({
						where: { id: formId },
						data: { isActive: true },
					});
				}

				return {
					authorization: updated,
					requestedById: auth.requestedById,
					formTitle: auth.form.title,
				};
			},
			{ isolationLevel: "Serializable" }
		);

		void notifyProjectRegistrationFormAuthorizationDecided({
			requestedByUserId: authorization.requestedById,
			formId,
			formTitle: authorization.formTitle,
			status,
		});

		return c.json({ authorization: authorization.authorization });
	}
);

// ─────────────────────────────────────────
// POST /committee/project-registration-forms/:formId/collaborators/:userId
// 共同編集者を追加（作成者のみ、対象はCREATE権限必須）
// ─────────────────────────────────────────
committeeProjectRegistrationFormRoute.post(
	"/:formId/collaborators/:userId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const cm = c.get("committeeMember");
		await requireCreatePermission(cm.id);

		const { formId, userId: targetUserId } =
			projectRegistrationFormCollaboratorPathParamsSchema.parse({
				formId: c.req.param("formId"),
				userId: c.req.param("userId"),
			});
		const userId = c.get("user").id;
		await requireOwner(formId, userId);

		if (targetUserId === userId)
			throw Errors.invalidRequest(
				"作成者を共同編集者に追加することはできません"
			);

		// 対象ユーザーが委員会メンバーかつCREATE権限を持つか確認
		const targetMember = await prisma.committeeMember.findFirst({
			where: { user: { id: targetUserId }, deletedAt: null },
			include: { permissions: true },
		});
		if (
			!targetMember ||
			!targetMember.permissions.some(
				p => p.permission === "PROJECT_REGISTRATION_FORM_CREATE"
			)
		) {
			throw Errors.invalidRequest(
				"対象ユーザーが委員会メンバーでないか、企画登録フォームの作成権限がありません"
			);
		}

		const body = await c.req.json().catch(() => ({}));
		const { isWrite } =
			addProjectRegistrationFormCollaboratorRequestSchema.parse(body);

		const collaborator = await prisma.$transaction(
			async tx => {
				const existing = await tx.projectRegistrationFormCollaborator.findFirst(
					{
						where: { formId, userId: targetUserId },
					}
				);
				if (existing) {
					if (!existing.deletedAt)
						throw Errors.alreadyExists("既に共同編集者として追加されています");
					// 論理削除済みの場合は再有効化
					return tx.projectRegistrationFormCollaborator.update({
						where: { id: existing.id },
						data: { deletedAt: null, isWrite },
					});
				}

				return tx.projectRegistrationFormCollaborator.create({
					data: { formId, userId: targetUserId, isWrite },
				});
			},
			{ isolationLevel: "Serializable" }
		);
		return c.json({ collaborator });
	}
);

// ─────────────────────────────────────────
// DELETE /committee/project-registration-forms/:formId/collaborators/:userId
// 共同編集者を削除（作成者のみ）
// ─────────────────────────────────────────
committeeProjectRegistrationFormRoute.delete(
	"/:formId/collaborators/:userId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const cm = c.get("committeeMember");
		await requireCreatePermission(cm.id);

		const { formId, userId: targetUserId } =
			projectRegistrationFormCollaboratorPathParamsSchema.parse({
				formId: c.req.param("formId"),
				userId: c.req.param("userId"),
			});
		const userId = c.get("user").id;

		await requireOwner(formId, userId);

		const collaborator =
			await prisma.projectRegistrationFormCollaborator.findFirst({
				where: { formId, userId: targetUserId, deletedAt: null },
			});
		if (!collaborator)
			throw Errors.notFound("対象ユーザーは共同編集者ではありません");

		await prisma.projectRegistrationFormCollaborator.update({
			where: { id: collaborator.id },
			data: { deletedAt: new Date() },
		});
		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/project-registration-forms/:formId/responses
// 回答一覧（実委人全員が閲覧可）
// ─────────────────────────────────────────────────────────────
committeeProjectRegistrationFormRoute.get(
	"/:formId/responses",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = projectRegistrationFormIdPathParamsSchema.parse(
			c.req.param()
		);

		const form = await prisma.projectRegistrationForm.findFirst({
			where: { id: formId, deletedAt: null },
		});
		if (!form) throw Errors.notFound("企画登録フォームが見つかりません");

		const responses = await prisma.projectRegistrationFormResponse.findMany({
			where: { formId },
			include: {
				project: {
					select: { id: true, name: true, organizationName: true },
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
				project: {
					id: r.project.id,
					name: r.project.name,
					organizationName: r.project.organizationName,
				},
				submittedAt: r.submittedAt,
				answers: r.answers.map(a => ({
					formItemId: a.formItemId,
					textValue: a.textValue,
					numberValue: a.numberValue,
					fileId: a.fileId,
					selectedOptions: a.selectedOptions.map(s => ({
						id: s.formItemOption.id,
						label: s.formItemOption.label,
					})),
				})),
			})),
		});
	}
);

export { committeeProjectRegistrationFormRoute };
