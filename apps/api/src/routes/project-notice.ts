import { projectNoticeIdPathParamsSchema } from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const projectNoticeRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// GET /project/:projectId/notices
// 配信済みお知らせ一覧（承認済み & 配信日時到来）
// ─────────────────────────────────────────────────────────────
projectNoticeRoute.get(
	"/:projectId/notices",
	requireAuth,
	requireProjectMember,
	async c => {
		const user = c.get("user");
		const project = c.get("project");

		const deliveries = await prisma.noticeDelivery.findMany({
			where: {
				projectId: project.id,
				noticeAuthorization: {
					status: "APPROVED",
					deliveredAt: { lte: new Date() },
					notice: { deletedAt: null },
				},
			},
			include: {
				noticeAuthorization: {
					include: {
						notice: {
							include: {
								owner: {
									select: {
										id: true,
										name: true,
										committeeMember: {
											select: { Bureau: true },
										},
									},
								},
							},
						},
					},
				},
				readStatuses: { where: { userId: user.id } },
			},
			orderBy: {
				noticeAuthorization: { deliveredAt: "desc" },
			},
		});

		const notices = deliveries.map(d => ({
			id: d.noticeAuthorization.notice.id,
			title: d.noticeAuthorization.notice.title,
			owner: {
				id: d.noticeAuthorization.notice.owner.id,
				name: d.noticeAuthorization.notice.owner.name,
			},
			ownerBureau:
				d.noticeAuthorization.notice.owner.committeeMember?.Bureau ?? "",
			deliveredAt: d.noticeAuthorization.deliveredAt,
			isRead: d.readStatuses.length > 0,
		}));

		return c.json({ notices });
	}
);

// ─────────────────────────────────────────────────────────────
// GET /project/:projectId/notices/:noticeId
// お知らせ詳細（対象企画に配信済みのもののみ）
// ─────────────────────────────────────────────────────────────
projectNoticeRoute.get(
	"/:projectId/notices/:noticeId",
	requireAuth,
	requireProjectMember,
	async c => {
		const user = c.get("user");
		const project = c.get("project");
		const { noticeId } = projectNoticeIdPathParamsSchema.parse({
			projectId: c.req.param("projectId"),
			noticeId: c.req.param("noticeId"),
		});

		const delivery = await prisma.noticeDelivery.findFirst({
			where: {
				projectId: project.id,
				noticeAuthorization: {
					status: "APPROVED",
					deliveredAt: { lte: new Date() },
					notice: { id: noticeId, deletedAt: null },
				},
			},
			include: {
				noticeAuthorization: {
					include: {
						notice: {
							include: {
								owner: {
									select: {
										id: true,
										name: true,
										committeeMember: {
											select: { Bureau: true },
										},
									},
								},
							},
						},
					},
				},
				readStatuses: { where: { userId: user.id } },
			},
		});

		if (!delivery) {
			throw Errors.notFound("お知らせが見つかりません");
		}

		const notice = {
			id: delivery.noticeAuthorization.notice.id,
			title: delivery.noticeAuthorization.notice.title,
			body: delivery.noticeAuthorization.notice.body,
			owner: {
				id: delivery.noticeAuthorization.notice.owner.id,
				name: delivery.noticeAuthorization.notice.owner.name,
			},
			ownerBureau:
				delivery.noticeAuthorization.notice.owner.committeeMember?.Bureau ?? "",
			deliveredAt: delivery.noticeAuthorization.deliveredAt,
			isRead: delivery.readStatuses.length > 0,
		};

		return c.json({ notice });
	}
);

// ─────────────────────────────────────────────────────────────
// POST /project/:projectId/notices/:noticeId/read
// お知らせを既読にする（冪等）
// ─────────────────────────────────────────────────────────────
projectNoticeRoute.post(
	"/:projectId/notices/:noticeId/read",
	requireAuth,
	requireProjectMember,
	async c => {
		const user = c.get("user");
		const project = c.get("project");
		const { noticeId } = projectNoticeIdPathParamsSchema.parse({
			projectId: c.req.param("projectId"),
			noticeId: c.req.param("noticeId"),
		});

		// 対象企画に配信済みの NoticeDelivery を特定
		const delivery = await prisma.noticeDelivery.findFirst({
			where: {
				projectId: project.id,
				noticeAuthorization: {
					status: "APPROVED",
					deliveredAt: { lte: new Date() },
					notice: { id: noticeId, deletedAt: null },
				},
			},
		});

		if (!delivery) {
			throw Errors.notFound("お知らせが見つかりません");
		}

		// 既読を作成（既に存在する場合は何もしない）
		await prisma.noticeReadStatus.upsert({
			where: {
				noticeDeliveryId_userId: {
					noticeDeliveryId: delivery.id,
					userId: user.id,
				},
			},
			create: {
				noticeDeliveryId: delivery.id,
				userId: user.id,
			},
			update: {},
		});

		return c.json({ success: true as const });
	}
);

export { projectNoticeRoute };
