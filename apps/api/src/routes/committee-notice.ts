import {
	addCollaboratorRequestSchema,
	createNoticeAuthorizationRequestSchema,
	createNoticeRequestSchema,
	noticeAuthorizationIdPathParamsSchema,
	noticeCollaboratorIdPathParamsSchema,
	noticeIdPathParamsSchema,
	updateNoticeAuthorizationRequestSchema,
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

// ─────────────────────────────────────────────────────────────
// POST /committee/notices/:noticeId/collaborators
// 共同編集者を追加（owner のみ）
// ─────────────────────────────────────────────────────────────
committeeNoticeRoute.post(
	"/:noticeId/collaborators",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { noticeId } = noticeIdPathParamsSchema.parse({
			noticeId: c.req.param("noticeId"),
		});
		const body = await c.req.json().catch(() => ({}));
		const { userId } = addCollaboratorRequestSchema.parse(body);

		const notice = await prisma.notice.findFirst({
			where: { id: noticeId, deletedAt: null },
		});

		if (!notice) {
			throw Errors.notFound("お知らせが見つかりません");
		}

		if (notice.ownerId !== user.id) {
			throw Errors.forbidden("共同編集者の追加はオーナーのみ可能です");
		}

		// 自分自身を追加できない
		if (userId === user.id) {
			throw Errors.invalidRequest("自分自身を共同編集者に追加できません");
		}

		// 対象ユーザーが実委人か確認
		const targetMember = await prisma.committeeMember.findFirst({
			where: { userId, deletedAt: null },
		});
		if (!targetMember) {
			throw Errors.invalidRequest("対象ユーザーは実委人ではありません");
		}

		// 既存チェック（ソフトデリート済みも含めて検索）
		const existing = await prisma.noticeCollaborator.findUnique({
			where: { noticeId_userId: { noticeId, userId } },
		});

		if (existing) {
			if (!existing.deletedAt) {
				throw Errors.alreadyExists("既に共同編集者です");
			}

			// ソフトデリート済み → 再有効化
			const reactivated = await prisma.noticeCollaborator.update({
				where: { id: existing.id },
				data: { deletedAt: null },
				include: { user: { select: { id: true, name: true } } },
			});

			return c.json(
				{ collaborator: { id: reactivated.id, user: reactivated.user } },
				201
			);
		}

		const collaborator = await prisma.noticeCollaborator.create({
			data: { noticeId, userId },
			include: { user: { select: { id: true, name: true } } },
		});

		return c.json(
			{ collaborator: { id: collaborator.id, user: collaborator.user } },
			201
		);
	}
);

// ─────────────────────────────────────────────────────────────
// DELETE /committee/notices/:noticeId/collaborators/:collaboratorId
// 共同編集者を削除（owner のみ）
// ─────────────────────────────────────────────────────────────
committeeNoticeRoute.delete(
	"/:noticeId/collaborators/:collaboratorId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { noticeId, collaboratorId } =
			noticeCollaboratorIdPathParamsSchema.parse({
				noticeId: c.req.param("noticeId"),
				collaboratorId: c.req.param("collaboratorId"),
			});

		const notice = await prisma.notice.findFirst({
			where: { id: noticeId, deletedAt: null },
		});

		if (!notice) {
			throw Errors.notFound("お知らせが見つかりません");
		}

		if (notice.ownerId !== user.id) {
			throw Errors.forbidden("共同編集者の削除はオーナーのみ可能です");
		}

		const collaborator = await prisma.noticeCollaborator.findFirst({
			where: { id: collaboratorId, noticeId, deletedAt: null },
		});

		if (!collaborator) {
			throw Errors.notFound("共同編集者が見つかりません");
		}

		await prisma.noticeCollaborator.update({
			where: { id: collaboratorId },
			data: { deletedAt: new Date() },
		});

		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────────────────────────
// POST /committee/notices/:noticeId/authorizations
// 配信承認を申請（owner または共同編集者 + NOTICE_DELIVER 権限）
// ─────────────────────────────────────────────────────────────
committeeNoticeRoute.post(
	"/:noticeId/authorizations",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const committeeMember = c.get("committeeMember");
		const { noticeId } = noticeIdPathParamsSchema.parse({
			noticeId: c.req.param("noticeId"),
		});
		const body = await c.req.json().catch(() => ({}));
		const { requestedToId, deliveredAt, projectIds } =
			createNoticeAuthorizationRequestSchema.parse(body);

		const notice = await prisma.notice.findFirst({
			where: { id: noticeId, deletedAt: null },
			include: { collaborators: { where: { deletedAt: null } } },
		});

		if (!notice) {
			throw Errors.notFound("お知らせが見つかりません");
		}

		// owner または共同編集者のみ
		const isOwner = notice.ownerId === user.id;
		const isCollaborator = notice.collaborators.some(
			col => col.userId === user.id
		);
		if (!isOwner && !isCollaborator) {
			throw Errors.forbidden("配信承認の申請権限がありません");
		}

		// NOTICE_DELIVER 権限チェック
		const hasPermission = await prisma.committeeMemberPermission.findFirst({
			where: {
				committeeMemberId: committeeMember.id,
				permission: "NOTICE_DELIVER",
			},
		});
		if (!hasPermission) {
			throw Errors.forbidden("NOTICE_DELIVER 権限が必要です");
		}

		// 承認者が共同編集者であること
		const isRequestedToCollaborator = notice.collaborators.some(
			col => col.userId === requestedToId
		);
		if (!isRequestedToCollaborator) {
			throw Errors.invalidRequest("承認者は共同編集者の中から指定してください");
		}

		// deliveredAt が未来であること
		if (deliveredAt <= new Date()) {
			throw Errors.invalidRequest("配信希望日時は未来の日時を指定してください");
		}

		// 既に PENDING または APPROVED の承認申請がないこと
		const existingAuth = await prisma.noticeAuthorization.findFirst({
			where: { noticeId, status: { in: ["PENDING", "APPROVED"] } },
		});
		if (existingAuth) {
			if (existingAuth.status === "APPROVED") {
				throw Errors.invalidRequest("このお知らせは既に承認されています");
			}
			throw Errors.alreadyExists("既に承認待ちの申請があります");
		}

		// 配信先企画の重複を排除
		const uniqueProjectIds = [...new Set(projectIds)];

		// 配信先企画が全て存在するか確認
		const existingProjects = await prisma.project.findMany({
			where: { id: { in: uniqueProjectIds }, deletedAt: null },
			select: { id: true },
		});
		if (existingProjects.length !== uniqueProjectIds.length) {
			const existingIds = new Set(existingProjects.map(p => p.id));
			const missingIds = uniqueProjectIds.filter(id => !existingIds.has(id));
			throw Errors.invalidRequest(
				`存在しない企画が含まれています: ${missingIds.join(", ")}`
			);
		}

		// トランザクションで承認 + 配信先を作成
		const authorization = await prisma.$transaction(async tx => {
			const auth = await tx.noticeAuthorization.create({
				data: {
					noticeId,
					requestedById: user.id,
					requestedToId,
					deliveredAt,
				},
			});

			const deliveries = await Promise.all(
				uniqueProjectIds.map(projectId =>
					tx.noticeDelivery.create({
						data: {
							noticeAuthorizationId: auth.id,
							projectId,
						},
					})
				)
			);

			return { ...auth, deliveries };
		});

		return c.json({ authorization }, 201);
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /committee/notices/:noticeId/authorizations/:authorizationId
// 承認 / 却下（requestedTo 本人のみ）
// ─────────────────────────────────────────────────────────────
committeeNoticeRoute.patch(
	"/:noticeId/authorizations/:authorizationId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { noticeId, authorizationId } =
			noticeAuthorizationIdPathParamsSchema.parse({
				noticeId: c.req.param("noticeId"),
				authorizationId: c.req.param("authorizationId"),
			});
		const body = await c.req.json().catch(() => ({}));
		const { status } = updateNoticeAuthorizationRequestSchema.parse(body);

		const authorization = await prisma.noticeAuthorization.findFirst({
			where: { id: authorizationId, noticeId },
		});

		if (!authorization) {
			throw Errors.notFound("承認申請が見つかりません");
		}

		// requestedTo 本人のみ
		if (authorization.requestedToId !== user.id) {
			throw Errors.forbidden("この承認申請を操作する権限がありません");
		}

		// PENDING でなければ操作不可
		if (authorization.status !== "PENDING") {
			throw Errors.invalidRequest("この承認申請は既に処理済みです");
		}

		// 承認する場合、deliveredAt が未来であること
		if (status === "APPROVED" && authorization.deliveredAt <= new Date()) {
			throw Errors.invalidRequest(
				"配信希望日時を過ぎているため承認できません。新しい日時で再申請してください"
			);
		}

		const updated = await prisma.noticeAuthorization.update({
			where: { id: authorizationId },
			data: { status, decidedAt: new Date() },
		});

		return c.json({ authorization: updated });
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/notices/:noticeId/status
// 企画ごとの既読状況を取得（owner または共同編集者）
// ─────────────────────────────────────────────────────────────
committeeNoticeRoute.get(
	"/:noticeId/status",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { noticeId } = noticeIdPathParamsSchema.parse({
			noticeId: c.req.param("noticeId"),
		});

		const notice = await prisma.notice.findFirst({
			where: { id: noticeId, deletedAt: null },
			include: { collaborators: { where: { deletedAt: null } } },
		});

		if (!notice) {
			throw Errors.notFound("お知らせが見つかりません");
		}

		// owner または共同編集者のみ
		const isOwner = notice.ownerId === user.id;
		const isCollaborator = notice.collaborators.some(
			col => col.userId === user.id
		);
		if (!isOwner && !isCollaborator) {
			throw Errors.forbidden("配信状況の閲覧権限がありません");
		}

		const deliveries = await prisma.noticeDelivery.findMany({
			where: { noticeAuthorization: { noticeId } },
			include: {
				project: { select: { id: true, name: true } },
				noticeAuthorization: {
					select: { status: true, deliveredAt: true },
				},
				readStatuses: true,
			},
		});

		// 企画ごとのメンバー数を取得
		const projectIds = deliveries.map(d => d.projectId);
		const projects = await prisma.project.findMany({
			where: { id: { in: projectIds }, deletedAt: null },
			include: {
				_count: {
					select: { projectMembers: { where: { deletedAt: null } } },
				},
			},
		});
		const memberCountMap = new Map(
			projects.map(p => [p.id, p._count.projectMembers])
		);

		const formatted = deliveries.map(d => ({
			id: d.id,
			project: d.project,
			authorization: {
				status: d.noticeAuthorization.status,
				deliveredAt: d.noticeAuthorization.deliveredAt,
			},
			readCount: d.readStatuses.length,
			memberCount: memberCountMap.get(d.projectId) ?? 0,
		}));

		return c.json({ deliveries: formatted });
	}
);

export { committeeNoticeRoute };
