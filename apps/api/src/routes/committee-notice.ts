import {
	createNoticeRequestSchema,
	noticeIdPathParamsSchema,
	updateNoticeRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeNoticeRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// POST /committee/notices
// お知らせを作成
// ─────────────────────────────────────────────────────────────
committeeNoticeRoute.post("/", requireAuth, requireCommitteeMember, async c => {
	const user = c.get("user");
	const body = await c.req.json().catch(() => ({}));
	const { title, body: noticeBody } = createNoticeRequestSchema.parse(body);

	const notice = await prisma.notice.create({
		data: {
			ownerId: user.id,
			title,
			body: noticeBody,
		},
	});

	return c.json({ notice }, 201);
});

// ─────────────────────────────────────────────────────────────
// GET /committee/notices
// お知らせ一覧を取得（実委人全員閲覧可）
// ─────────────────────────────────────────────────────────────
committeeNoticeRoute.get("/", requireAuth, requireCommitteeMember, async c => {
	const notices = await prisma.notice.findMany({
		where: { deletedAt: null },
		include: {
			owner: { select: { id: true, name: true } },
			collaborators: {
				where: { deletedAt: null },
				include: { user: { select: { id: true, name: true } } },
			},
			authorizations: {
				include: {
					requestedTo: { select: { id: true, name: true } },
				},
				orderBy: { createdAt: "desc" },
				take: 1,
			},
		},
		orderBy: { updatedAt: "desc" },
	});

	// レスポンス形式に整形
	const formatted = notices.map(n => {
		const latestAuth = n.authorizations[0] ?? null;
		return {
			id: n.id,
			ownerId: n.ownerId,
			title: n.title,
			createdAt: n.createdAt,
			updatedAt: n.updatedAt,
			owner: n.owner,
			collaborators: n.collaborators.map(col => col.user),
			authorization: latestAuth
				? {
						id: latestAuth.id,
						status: latestAuth.status,
						deliveredAt: latestAuth.deliveredAt,
						requestedTo: latestAuth.requestedTo,
					}
				: null,
		};
	});

	return c.json({ notices: formatted });
});

// ─────────────────────────────────────────────────────────────
// GET /committee/notices/:noticeId
// お知らせ詳細を取得（実委人全員閲覧可）
// ─────────────────────────────────────────────────────────────
committeeNoticeRoute.get(
	"/:noticeId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { noticeId } = noticeIdPathParamsSchema.parse({
			noticeId: c.req.param("noticeId"),
		});

		const notice = await prisma.notice.findFirst({
			where: { id: noticeId, deletedAt: null },
			include: {
				owner: { select: { id: true, name: true } },
				collaborators: {
					where: { deletedAt: null },
					include: { user: { select: { id: true, name: true } } },
				},
				authorizations: {
					include: {
						requestedBy: { select: { id: true, name: true } },
						requestedTo: { select: { id: true, name: true } },
						deliveries: {
							include: {
								project: { select: { id: true, name: true } },
							},
						},
					},
					orderBy: { createdAt: "desc" },
				},
			},
		});

		if (!notice) {
			throw Errors.notFound("お知らせが見つかりません");
		}

		// レスポンス形式に整形（deletedAt を除外）
		const formatted = {
			id: notice.id,
			ownerId: notice.ownerId,
			title: notice.title,
			body: notice.body,
			createdAt: notice.createdAt,
			updatedAt: notice.updatedAt,
			owner: notice.owner,
			collaborators: notice.collaborators.map(col => ({
				id: col.id,
				user: col.user,
			})),
			authorizations: notice.authorizations.map(auth => ({
				id: auth.id,
				noticeId: auth.noticeId,
				requestedById: auth.requestedById,
				requestedToId: auth.requestedToId,
				status: auth.status,
				decidedAt: auth.decidedAt,
				deliveredAt: auth.deliveredAt,
				createdAt: auth.createdAt,
				updatedAt: auth.updatedAt,
				requestedBy: auth.requestedBy,
				requestedTo: auth.requestedTo,
				deliveries: auth.deliveries.map(del => ({
					id: del.id,
					noticeAuthorizationId: del.noticeAuthorizationId,
					projectId: del.projectId,
					createdAt: del.createdAt,
					project: del.project,
				})),
			})),
		};

		return c.json({ notice: formatted });
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /committee/notices/:noticeId
// お知らせを編集（owner または共同編集者のみ）
// ─────────────────────────────────────────────────────────────
committeeNoticeRoute.patch(
	"/:noticeId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { noticeId } = noticeIdPathParamsSchema.parse({
			noticeId: c.req.param("noticeId"),
		});
		const body = await c.req.json().catch(() => ({}));
		const data = updateNoticeRequestSchema.parse(body);

		const notice = await prisma.notice.findFirst({
			where: { id: noticeId, deletedAt: null },
			include: {
				collaborators: { where: { deletedAt: null } },
			},
		});

		if (!notice) {
			throw Errors.notFound("お知らせが見つかりません");
		}

		// owner または共同編集者のみ編集可能
		const isOwner = notice.ownerId === user.id;
		const isCollaborator = notice.collaborators.some(
			col => col.userId === user.id
		);
		if (!isOwner && !isCollaborator) {
			throw Errors.forbidden("編集権限がありません");
		}

		const updated = await prisma.notice.update({
			where: { id: noticeId },
			data,
		});

		return c.json({ notice: updated });
	}
);

// ─────────────────────────────────────────────────────────────
// DELETE /committee/notices/:noticeId
// お知らせを削除（owner のみ）
// ─────────────────────────────────────────────────────────────
committeeNoticeRoute.delete(
	"/:noticeId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { noticeId } = noticeIdPathParamsSchema.parse({
			noticeId: c.req.param("noticeId"),
		});

		const notice = await prisma.notice.findFirst({
			where: { id: noticeId, deletedAt: null },
		});

		if (!notice) {
			throw Errors.notFound("お知らせが見つかりません");
		}

		if (notice.ownerId !== user.id) {
			throw Errors.forbidden("削除権限がありません");
		}

		await prisma.notice.update({
			where: { id: noticeId },
			data: { deletedAt: new Date() },
		});

		return c.json({ success: true as const });
	}
);

export { committeeNoticeRoute };
