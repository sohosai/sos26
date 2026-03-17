import type { ProjectLocation, ProjectType } from "@prisma/client";
import { projectNoticeIdPathParamsSchema } from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const projectNoticeRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// ヘルパー: カテゴリ指定の遅延Delivery同期
// ─────────────────────────────────────────────────────────────
async function syncCategoryNoticeDeliveries(
	projectId: string,
	projectType: ProjectType,
	projectLocation: ProjectLocation
) {
	const now = new Date();

	// カテゴリモードで承認済み・配信時刻到来済みの Authorization を取得
	const categoryAuths = await prisma.noticeAuthorization.findMany({
		where: {
			deliveryMode: "CATEGORY",
			status: "APPROVED",
			deliveredAt: { lte: now },
			notice: { deletedAt: null },
		},
		select: { id: true, filterTypes: true, filterLocations: true },
	});

	// フィルタ条件に合致する Authorization を絞り込み（AND条件）
	const matchingAuthIds = categoryAuths
		.filter(auth => {
			const typeOk =
				auth.filterTypes.length === 0 || auth.filterTypes.includes(projectType);
			const locationOk =
				auth.filterLocations.length === 0 ||
				auth.filterLocations.includes(projectLocation);
			return typeOk && locationOk;
		})
		.map(auth => auth.id);

	if (matchingAuthIds.length === 0) return;

	// この企画に対して既に Delivery が存在する Authorization を一括取得
	const existingDeliveries = await prisma.noticeDelivery.findMany({
		where: {
			projectId,
			noticeAuthorizationId: { in: matchingAuthIds },
		},
		select: { noticeAuthorizationId: true },
	});

	const existingAuthIds = new Set(
		existingDeliveries.map(d => d.noticeAuthorizationId)
	);

	// 未作成分だけ一括作成
	const newDeliveries = matchingAuthIds
		.filter(id => !existingAuthIds.has(id))
		.map(noticeAuthorizationId => ({ noticeAuthorizationId, projectId }));

	if (newDeliveries.length > 0) {
		await prisma.noticeDelivery.createMany({
			data: newDeliveries,
			skipDuplicates: true,
		});
	}
}

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

		// カテゴリ指定の遅延Delivery同期
		await syncCategoryNoticeDeliveries(
			project.id,
			project.type,
			project.location
		);

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

		// カテゴリ指定の遅延Delivery同期
		await syncCategoryNoticeDeliveries(
			project.id,
			project.type,
			project.location
		);

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
								attachments: {
									where: { deletedAt: null },
									include: {
										file: {
											select: {
												id: true,
												fileName: true,
												mimeType: true,
												size: true,
												isPublic: true,
											},
										},
									},
									orderBy: { createdAt: "asc" },
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
			attachments: delivery.noticeAuthorization.notice.attachments.map(att => ({
				id: att.id,
				fileId: att.file.id,
				fileName: att.file.fileName,
				mimeType: att.file.mimeType,
				size: att.file.size,
				isPublic: att.file.isPublic,
				createdAt: att.createdAt,
			})),
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

		// カテゴリ指定の遅延Delivery同期
		await syncCategoryNoticeDeliveries(
			project.id,
			project.type,
			project.location
		);

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
