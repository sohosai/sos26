import {
	createProjectRegistrationFormRequestSchema,
	projectRegistrationFormAuthorizationPathParamsSchema,
	projectRegistrationFormIdPathParamsSchema,
	requestProjectRegistrationFormAuthorizationRequestSchema,
	updateProjectRegistrationFormAuthorizationRequestSchema,
	updateProjectRegistrationFormRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
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

// PROJECT_REGISTRATION_FORM_CREATE 権限または委員長チェック
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

		const form = await prisma.projectRegistrationForm.create({
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
				items: {
					include: { options: { orderBy: { sortOrder: "asc" } } },
					orderBy: { sortOrder: "asc" },
				},
				authorizations: {
					include: { requestedBy: true, requestedTo: true },
				},
			},
		});

		return c.json({ form });
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
				owner: true,
				authorizations: {
					orderBy: { createdAt: "desc" },
					take: 1,
				},
			},
			orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
		});

		return c.json({
			forms: forms.map(f => ({
				...f,
				latestAuthorization: f.authorizations[0] ?? null,
				authorizations: undefined,
			})),
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
		return c.json({ form });
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
		await requireOwner(formId, userId);

		const body = await c.req.json().catch(() => ({}));
		const { items, ...formData } =
			updateProjectRegistrationFormRequestSchema.parse(body);

		const form = await prisma.$transaction(
			async tx => {
				await tx.projectRegistrationForm.update({
					where: { id: formId },
					data: { ...formData },
				});

				if (items !== undefined) {
					// 既存の items を全削除して再作成
					await tx.projectRegistrationFormItem.deleteMany({
						where: { formId },
					});
					for (const { options, ...item } of items) {
						await tx.projectRegistrationFormItem.create({
							data: {
								...item,
								formId,
								options: options?.length ? { create: options } : undefined,
							},
						});
					}
				}

				return tx.projectRegistrationForm.findUniqueOrThrow({
					where: { id: formId },
					include: {
						items: {
							include: { options: { orderBy: { sortOrder: "asc" } } },
							orderBy: { sortOrder: "asc" },
						},
						authorizations: {
							include: { requestedBy: true, requestedTo: true },
							orderBy: { createdAt: "desc" },
						},
					},
				});
			},
			{ isolationLevel: "Serializable" }
		);

		return c.json({ form });
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
		await requireOwner(formId, userId);

		const now = new Date();
		await prisma.$transaction([
			prisma.projectRegistrationForm.update({
				where: { id: formId },
				data: { deletedAt: now, isActive: false },
			}),
			prisma.projectRegistrationFormAuthorization.updateMany({
				where: { formId, status: "PENDING" },
				data: { status: "REJECTED", decidedAt: now },
			}),
		]);

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
		await requireOwner(formId, userId);

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
		const deliverMember = await prisma.committeeMember.findFirst({
			where: {
				userId: requestedToId,
				deletedAt: null,
			},
			include: { permissions: true },
		});
		if (
			!deliverMember ||
			!deliverMember.permissions.some(
				p => p.permission === "PROJECT_REGISTRATION_FORM_DELIVER"
			)
		) {
			throw Errors.invalidRequest(
				"承認依頼先のユーザーに企画登録フォーム承認権限がありません"
			);
		}

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
						form: { select: { deletedAt: true } },
					},
				});

				if (!auth) throw Errors.notFound("承認申請が見つかりません");
				if (auth.form.deletedAt)
					throw Errors.invalidRequest("削除済みのフォームは承認できません");
				if (auth.requestedToId !== user.id)
					throw Errors.forbidden("この承認申請を操作する権限がありません");
				if (auth.status !== "PENDING")
					throw Errors.invalidRequest("この承認申請は既に処理済みです");

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

				return updated;
			},
			{ isolationLevel: "Serializable" }
		);

		return c.json({ authorization });
	}
);

export { committeeProjectRegistrationFormRoute };
