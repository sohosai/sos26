import {
	addInquiryAssigneeRequestSchema,
	addInquiryCommentRequestSchema,
	createProjectInquiryRequestSchema,
	projectInquiryAssigneeIdPathParamsSchema,
	projectInquiryIdPathParamsSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const projectInquiryRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// ヘルパー: 企画側担当者チェック
// ─────────────────────────────────────────────────────────────

async function requireProjectAssignee(inquiryId: string, userId: string) {
	const assignee = await prisma.inquiryAssignee.findFirst({
		where: { inquiryId, userId, side: "PROJECT" },
	});
	if (!assignee) {
		throw Errors.forbidden("この問い合わせの担当者ではありません");
	}
	return assignee;
}

// ─────────────────────────────────────────────────────────────
// レスポンス整形ヘルパー
// ─────────────────────────────────────────────────────────────

const userSelect = { id: true, name: true } as const;

const assigneeInclude = {
	user: { select: userSelect },
} as const;

function formatAssignee(a: {
	id: string;
	side: string;
	isCreator: boolean;
	assignedAt: Date;
	user: { id: string; name: string };
}) {
	return {
		id: a.id,
		side: a.side,
		isCreator: a.isCreator,
		assignedAt: a.assignedAt,
		user: a.user,
	};
}

// ─────────────────────────────────────────────────────────────
// POST /project/:projectId/inquiries
// お問い合わせを作成
// ─────────────────────────────────────────────────────────────
projectInquiryRoute.post(
	"/:projectId/inquiries",
	requireAuth,
	requireProjectMember,
	async c => {
		const user = c.get("user");
		const project = c.get("project");
		const body = await c.req.json().catch(() => ({}));
		const { title, body: inquiryBody } =
			createProjectInquiryRequestSchema.parse(body);

		const inquiry = await prisma.inquiry.create({
			data: {
				title,
				body: inquiryBody,
				status: "UNASSIGNED",
				createdById: user.id,
				creatorRole: "PROJECT",
				projectId: project.id,
				assignees: {
					create: {
						userId: user.id,
						side: "PROJECT",
						isCreator: true,
					},
				},
			},
		});

		return c.json({ inquiry }, 201);
	}
);

// ─────────────────────────────────────────────────────────────
// GET /project/:projectId/inquiries
// 自分が企画側担当者のお問い合わせ一覧
// ─────────────────────────────────────────────────────────────
projectInquiryRoute.get(
	"/:projectId/inquiries",
	requireAuth,
	requireProjectMember,
	async c => {
		const user = c.get("user");
		const project = c.get("project");

		const inquiries = await prisma.inquiry.findMany({
			where: {
				projectId: project.id,
				assignees: { some: { userId: user.id, side: "PROJECT" } },
			},
			include: {
				createdBy: { select: userSelect },
				project: { select: { id: true, name: true } },
				assignees: { include: assigneeInclude },
				_count: { select: { comments: true } },
			},
			orderBy: { updatedAt: "desc" },
		});

		const formatted = inquiries.map(inq => ({
			id: inq.id,
			title: inq.title,
			status: inq.status,
			creatorRole: inq.creatorRole,
			createdAt: inq.createdAt,
			updatedAt: inq.updatedAt,
			createdBy: inq.createdBy,
			project: inq.project,
			projectAssignees: inq.assignees
				.filter(a => a.side === "PROJECT")
				.map(formatAssignee),
			committeeAssignees: inq.assignees
				.filter(a => a.side === "COMMITTEE")
				.map(formatAssignee),
			commentCount: inq._count.comments,
		}));

		return c.json({ inquiries: formatted });
	}
);

// ─────────────────────────────────────────────────────────────
// GET /project/:projectId/inquiries/:inquiryId
// お問い合わせ詳細
// ─────────────────────────────────────────────────────────────
projectInquiryRoute.get(
	"/:projectId/inquiries/:inquiryId",
	requireAuth,
	requireProjectMember,
	async c => {
		const user = c.get("user");
		const project = c.get("project");
		const { inquiryId } = projectInquiryIdPathParamsSchema.parse({
			projectId: c.req.param("projectId"),
			inquiryId: c.req.param("inquiryId"),
		});

		// 企画側担当者チェック
		await requireProjectAssignee(inquiryId, user.id);

		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, projectId: project.id },
			include: {
				createdBy: { select: userSelect },
				project: { select: { id: true, name: true } },
				assignees: { include: assigneeInclude },
				comments: {
					include: { createdBy: { select: userSelect } },
					orderBy: { createdAt: "asc" },
				},
				activities: {
					include: {
						actor: { select: userSelect },
						target: { select: userSelect },
					},
					orderBy: { createdAt: "asc" },
				},
			},
		});

		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}

		const formatted = {
			id: inquiry.id,
			title: inquiry.title,
			body: inquiry.body,
			status: inquiry.status,
			createdById: inquiry.createdById,
			creatorRole: inquiry.creatorRole,
			projectId: inquiry.projectId,
			relatedFormId: inquiry.relatedFormId,
			createdAt: inquiry.createdAt,
			updatedAt: inquiry.updatedAt,
			createdBy: inquiry.createdBy,
			project: inquiry.project,
			projectAssignees: inquiry.assignees
				.filter(a => a.side === "PROJECT")
				.map(formatAssignee),
			committeeAssignees: inquiry.assignees
				.filter(a => a.side === "COMMITTEE")
				.map(formatAssignee),
			comments: inquiry.comments.map(cm => ({
				id: cm.id,
				body: cm.body,
				createdAt: cm.createdAt,
				createdBy: cm.createdBy,
			})),
			activities: inquiry.activities.map(act => ({
				id: act.id,
				type: act.type,
				createdAt: act.createdAt,
				actor: act.actor,
				target: act.target,
			})),
		};

		return c.json({ inquiry: formatted });
	}
);

// ─────────────────────────────────────────────────────────────
// POST /project/:projectId/inquiries/:inquiryId/comments
// コメント追加
// ─────────────────────────────────────────────────────────────
projectInquiryRoute.post(
	"/:projectId/inquiries/:inquiryId/comments",
	requireAuth,
	requireProjectMember,
	async c => {
		const user = c.get("user");
		const project = c.get("project");
		const { inquiryId } = projectInquiryIdPathParamsSchema.parse({
			projectId: c.req.param("projectId"),
			inquiryId: c.req.param("inquiryId"),
		});
		const body = await c.req.json().catch(() => ({}));
		const { body: commentBody } = addInquiryCommentRequestSchema.parse(body);

		// 企画側担当者チェック
		await requireProjectAssignee(inquiryId, user.id);

		// ステータスチェック
		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, projectId: project.id },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}
		if (inquiry.status === "RESOLVED") {
			throw Errors.invalidRequest(
				"解決済みのお問い合わせにはコメントできません"
			);
		}

		const comment = await prisma.inquiryComment.create({
			data: {
				inquiryId,
				body: commentBody,
				createdById: user.id,
			},
			include: { createdBy: { select: userSelect } },
		});

		return c.json(
			{
				comment: {
					id: comment.id,
					body: comment.body,
					createdAt: comment.createdAt,
					createdBy: comment.createdBy,
				},
			},
			201
		);
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /project/:projectId/inquiries/:inquiryId/reopen
// 再オープン（RESOLVED → IN_PROGRESS）
// ─────────────────────────────────────────────────────────────
projectInquiryRoute.patch(
	"/:projectId/inquiries/:inquiryId/reopen",
	requireAuth,
	requireProjectMember,
	async c => {
		const user = c.get("user");
		const project = c.get("project");
		const { inquiryId } = projectInquiryIdPathParamsSchema.parse({
			projectId: c.req.param("projectId"),
			inquiryId: c.req.param("inquiryId"),
		});

		// 企画側担当者チェック
		await requireProjectAssignee(inquiryId, user.id);

		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, projectId: project.id },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}
		if (inquiry.status !== "RESOLVED") {
			throw Errors.invalidRequest(
				"解決済みのお問い合わせのみ再オープンできます"
			);
		}

		const [updated] = await prisma.$transaction([
			prisma.inquiry.update({
				where: { id: inquiryId },
				data: { status: "IN_PROGRESS" },
			}),
			prisma.inquiryActivity.create({
				data: {
					inquiryId,
					type: "STATUS_REOPENED",
					actorId: user.id,
				},
			}),
		]);

		return c.json({ inquiry: updated });
	}
);

// ─────────────────────────────────────────────────────────────
// POST /project/:projectId/inquiries/:inquiryId/assignees
// 企画側担当者追加（同企画メンバーのみ）
// ─────────────────────────────────────────────────────────────
projectInquiryRoute.post(
	"/:projectId/inquiries/:inquiryId/assignees",
	requireAuth,
	requireProjectMember,
	async c => {
		const user = c.get("user");
		const project = c.get("project");
		const { inquiryId } = projectInquiryIdPathParamsSchema.parse({
			projectId: c.req.param("projectId"),
			inquiryId: c.req.param("inquiryId"),
		});
		const body = await c.req.json().catch(() => ({}));
		const { userId, side } = addInquiryAssigneeRequestSchema.parse(body);

		// 企画側担当者チェック
		await requireProjectAssignee(inquiryId, user.id);

		// 企画側からは企画側担当者のみ追加可能
		if (side !== "PROJECT") {
			throw Errors.forbidden("企画側からは企画側の担当者のみ追加できます");
		}

		// 追加対象が同企画のメンバーかチェック
		const targetProject = await prisma.project.findFirst({
			where: { id: project.id, deletedAt: null },
		});
		if (!targetProject) {
			throw Errors.notFound("企画が見つかりません");
		}

		const isOwner = targetProject.ownerId === userId;
		const isSubOwner = targetProject.subOwnerId === userId;
		const isMember = await prisma.projectMember.findFirst({
			where: { projectId: project.id, userId, deletedAt: null },
		});
		if (!isOwner && !isSubOwner && !isMember) {
			throw Errors.invalidRequest(
				"対象ユーザーはこの企画のメンバーではありません"
			);
		}

		// 既に担当者かチェック
		const existing = await prisma.inquiryAssignee.findUnique({
			where: { inquiryId_userId: { inquiryId, userId } },
		});
		if (existing) {
			throw Errors.alreadyExists("既に担当者です");
		}

		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, projectId: project.id },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}

		const assignee = await prisma.$transaction(async tx => {
			const created = await tx.inquiryAssignee.create({
				data: { inquiryId, userId, side: "PROJECT", isCreator: false },
				include: { user: { select: userSelect } },
			});

			await tx.inquiryActivity.create({
				data: {
					inquiryId,
					type: "ASSIGNEE_ADDED",
					actorId: user.id,
					targetId: userId,
				},
			});

			return created;
		});

		return c.json({ assignee: formatAssignee(assignee) }, 201);
	}
);

// ─────────────────────────────────────────────────────────────
// DELETE /project/:projectId/inquiries/:inquiryId/assignees/:assigneeId
// 企画側担当者削除（作成者は削除不可）
// ─────────────────────────────────────────────────────────────
projectInquiryRoute.delete(
	"/:projectId/inquiries/:inquiryId/assignees/:assigneeId",
	requireAuth,
	requireProjectMember,
	async c => {
		const user = c.get("user");
		const project = c.get("project");
		const { inquiryId, assigneeId } =
			projectInquiryAssigneeIdPathParamsSchema.parse({
				projectId: c.req.param("projectId"),
				inquiryId: c.req.param("inquiryId"),
				assigneeId: c.req.param("assigneeId"),
			});

		// 企画側担当者チェック
		await requireProjectAssignee(inquiryId, user.id);

		// お問い合わせの存在チェック
		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, projectId: project.id },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}

		const assignee = await prisma.inquiryAssignee.findFirst({
			where: { id: assigneeId, inquiryId },
		});
		if (!assignee) {
			throw Errors.notFound("担当者が見つかりません");
		}
		if (assignee.isCreator) {
			throw Errors.invalidRequest("作成者は担当者から削除できません");
		}

		await prisma.$transaction([
			prisma.inquiryAssignee.delete({ where: { id: assigneeId } }),
			prisma.inquiryActivity.create({
				data: {
					inquiryId,
					type: "ASSIGNEE_REMOVED",
					actorId: user.id,
					targetId: assignee.userId,
				},
			}),
		]);

		return c.json({ success: true as const });
	}
);

export { projectInquiryRoute };
