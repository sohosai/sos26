import {
	mastersheetAccessRequestIdPathParamsSchema,
	mastersheetColumnIdPathParamsSchema,
	updateMastersheetAccessRequestRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../../lib/error";
import {
	notifyAccessRequestDecided,
	notifyAccessRequestReceived,
} from "../../lib/notifications";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../../middlewares/auth";
import type { AuthEnv } from "../../types/auth-env";
import { type ColumnFull, getColumnFull } from "./helpers";

export const accessRequestsRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// ヘルパー（このファイル内のみ）
// ─────────────────────────────────────────────────────────────

/** FORM_ITEM カラムへのアクセス申請（PENDING）を作成 */
async function createFormItemAccessRequest(
	columnId: string,
	formId: string,
	userId: string
) {
	const form = await prisma.form.findFirst({
		where: { id: formId, deletedAt: null },
		include: { collaborators: { where: { deletedAt: null } } },
	});
	if (!form) throw Errors.notFound("申請が見つかりません");

	const hasAccess =
		form.ownerId === userId ||
		form.collaborators.some(c => c.userId === userId);
	if (hasAccess) throw Errors.alreadyExists("既にアクセス権があります");

	const pending = await prisma.mastersheetAccessRequest.findFirst({
		where: { columnId, requesterId: userId, status: "PENDING" },
	});
	if (pending) throw Errors.alreadyExists("既に申請中です");

	await prisma.mastersheetAccessRequest.create({
		data: { columnId, requesterId: userId, status: "PENDING" },
	});
}

/** 承認時にカラム種別に応じたアクセス権を付与する */
async function grantAccessOnApproval(
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
	request: {
		requesterId: string;
		columnId: string;
		column: {
			type: string;
			formItem: { formId: string } | null;
			projectRegistrationFormItem: { formId: string } | null;
		};
	}
) {
	if (request.column.type === "PROJECT_REGISTRATION_FORM_ITEM") {
		// 企画登録情報カラムは全実委人がアクセス可能なため、アクセス権付与は不要
		return;
	}

	if (request.column.type === "FORM_ITEM" && request.column.formItem) {
		await tx.formCollaborator.upsert({
			where: {
				formId_userId: {
					formId: request.column.formItem.formId,
					userId: request.requesterId,
				},
			},
			create: {
				formId: request.column.formItem.formId,
				userId: request.requesterId,
				isWrite: true,
			},
			update: { deletedAt: null },
		});
	} else {
		await tx.mastersheetColumnViewer.create({
			data: {
				columnId: request.columnId,
				scope: "INDIVIDUAL",
				userId: request.requesterId,
			},
		});
	}
}

/** CUSTOM カラムへのアクセス申請（PENDING）を作成 */
async function createCustomAccessRequest(
	col: ColumnFull,
	columnId: string,
	userId: string
) {
	if (col.createdById === userId)
		throw Errors.alreadyExists("既にアクセス権があります");

	const viewerEntry = col.viewers.find(
		v => v.scope === "ALL" || (v.scope === "INDIVIDUAL" && v.userId === userId)
	);
	if (viewerEntry) throw Errors.alreadyExists("既にアクセス権があります");

	const pending = await prisma.mastersheetAccessRequest.findFirst({
		where: { columnId, requesterId: userId, status: "PENDING" },
	});
	if (pending) throw Errors.alreadyExists("既に申請中です");

	await prisma.mastersheetAccessRequest.create({
		data: { columnId, requesterId: userId, status: "PENDING" },
	});
}

// ─────────────────────────────────────────────────────────────
// POST /committee/mastersheet/columns/:columnId/access-request
// ─────────────────────────────────────────────────────────────

accessRequestsRoute.post(
	"/columns/:columnId/access-request",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const userId = user.id;
		const { columnId } = mastersheetColumnIdPathParamsSchema.parse(
			c.req.param()
		);

		const col = await getColumnFull(columnId);

		if (col.type === "PROJECT_REGISTRATION_FORM_ITEM") {
			throw Errors.invalidRequest(
				"企画登録情報カラムは全実委人がアクセス可能なため申請不要です"
			);
		}

		if (col.type === "FORM_ITEM") {
			if (!col.formItem) throw Errors.notFound("申請項目が見つかりません");
			await createFormItemAccessRequest(columnId, col.formItem.formId, userId);
		} else {
			await createCustomAccessRequest(col, columnId, userId);
		}

		void notifyAccessRequestReceived({
			columnId,
			requesterName: user.name,
		});

		return c.json({ success: true as const }, 201);
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /committee/mastersheet/access-requests/:requestId
// カラム管理者がアクセス申請を承認・却下
// ─────────────────────────────────────────────────────────────

accessRequestsRoute.patch(
	"/access-requests/:requestId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const { requestId } = mastersheetAccessRequestIdPathParamsSchema.parse(
			c.req.param()
		);

		const body = await c.req.json().catch(() => ({}));
		const { status } = updateMastersheetAccessRequestRequestSchema.parse(body);

		const result = await prisma.$transaction(
			async tx => {
				const request = await tx.mastersheetAccessRequest.findUnique({
					where: { id: requestId },
					include: {
						column: {
							include: {
								formItem: {
									include: { form: { select: { ownerId: true } } },
								},
								projectRegistrationFormItem: {
									include: { form: { select: { ownerId: true } } },
								},
							},
						},
					},
				});
				if (!request) throw Errors.notFound("申請が見つかりません");

				// 権限チェック（種別によって承認者が異なる）
				const canDecide =
					request.column.type === "FORM_ITEM"
						? request.column.formItem?.form.ownerId === userId
						: request.column.createdById === userId;
				if (!canDecide)
					throw Errors.forbidden("この申請を操作する権限がありません");

				if (request.status !== "PENDING")
					throw Errors.invalidRequest("この申請は既に処理済みです");

				await tx.mastersheetAccessRequest.update({
					where: { id: requestId },
					data: { status, decidedById: userId, decidedAt: new Date() },
				});

				if (status === "APPROVED") {
					await grantAccessOnApproval(tx, request);
				}

				return {
					requesterId: request.requesterId,
					columnName: request.column.name,
				};
			},
			{ isolationLevel: "Serializable" }
		);

		void notifyAccessRequestDecided({
			requesterId: result.requesterId,
			columnName: result.columnName,
			status,
		});

		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/access-requests
// 自分が承認権限を持つ PENDING 申請一覧
// ─────────────────────────────────────────────────────────────

accessRequestsRoute.get(
	"/access-requests",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const requests = await prisma.mastersheetAccessRequest.findMany({
			where: {
				status: "PENDING",
				OR: [
					{ column: { type: "CUSTOM", createdById: userId } },
					{
						column: {
							type: "FORM_ITEM",
							formItem: { form: { ownerId: userId } },
						},
					},
				],
			},
			include: { requester: { select: { id: true, name: true } } },
			orderBy: { createdAt: "asc" },
		});
		return c.json({
			requests: requests.map(r => ({
				id: r.id,
				columnId: r.columnId,
				requester: r.requester,
				createdAt: r.createdAt,
			})),
		});
	}
);
