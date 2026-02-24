import type { CommitteeMember } from "@prisma/client";
import {
	addInquiryAssigneeRequestSchema,
	addInquiryCommentRequestSchema,
	committeeInquiryAssigneeIdPathParamsSchema,
	createCommitteeInquiryRequestSchema,
	inquiryIdPathParamsSchema,
	updateInquiryStatusRequestSchema,
	updateInquiryViewersRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import {
	notifyInquiryAssigneeAdded,
	notifyInquiryCommentAdded,
	notifyInquiryCreatedByCommittee,
} from "../lib/notifications";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeInquiryRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// 権限チェックヘルパー
// ─────────────────────────────────────────────────────────────

/** INQUIRY_ADMIN 権限を持っているか */
async function isInquiryAdmin(committeeMemberId: string): Promise<boolean> {
	const perm = await prisma.committeeMemberPermission.findFirst({
		where: { committeeMemberId, permission: "INQUIRY_ADMIN" },
	});
	return !!perm;
}

/** 実委側担当者かどうか */
async function isCommitteeAssignee(
	inquiryId: string,
	userId: string
): Promise<boolean> {
	const assignee = await prisma.inquiryAssignee.findFirst({
		where: { inquiryId, userId, side: "COMMITTEE", deletedAt: null },
	});
	return !!assignee;
}

/** 担当者 or 管理者チェック（コメント・ステータス変更・担当者操作用） */
async function requireAssigneeOrAdmin(
	inquiryId: string,
	userId: string,
	committeeMember: CommitteeMember
) {
	const admin = await isInquiryAdmin(committeeMember.id);
	if (admin) return;
	const assignee = await isCommitteeAssignee(inquiryId, userId);
	if (assignee) return;
	throw Errors.forbidden("この操作を行う権限がありません");
}

/**
 * 閲覧権限チェック
 * 1. INQUIRY_ADMIN → 閲覧可能
 * 2. 実委側担当者 → 閲覧可能
 * 3. 閲覧者に含まれる → 閲覧可能
 * 4. いずれにも該当しない → 閲覧不可
 */
async function canViewInquiry(
	inquiryId: string,
	userId: string,
	committeeMember: CommitteeMember
): Promise<boolean> {
	// 1. INQUIRY_ADMIN
	if (await isInquiryAdmin(committeeMember.id)) return true;

	// 2. 実委側担当者
	if (await isCommitteeAssignee(inquiryId, userId)) return true;

	// 3. 閲覧者チェック
	const viewers = await prisma.inquiryViewer.findMany({
		where: { inquiryId, deletedAt: null },
	});

	for (const viewer of viewers) {
		// 3a. scope = ALL
		if (viewer.scope === "ALL") return true;

		// 3b. scope = BUREAU かつ自分の所属局と一致
		if (
			viewer.scope === "BUREAU" &&
			viewer.bureauValue === committeeMember.Bureau
		)
			return true;

		// 3c. scope = INDIVIDUAL かつ自分の userId と一致
		if (viewer.scope === "INDIVIDUAL" && viewer.userId === userId) return true;
	}

	// 4. 該当なし
	return false;
}

// ─────────────────────────────────────────────────────────────
// レスポンス整形ヘルパー
// ─────────────────────────────────────────────────────────────

const userSelect = { id: true, name: true } as const;

const assigneeInclude = {
	user: { select: userSelect },
} as const;

const attachmentInclude = {
	file: {
		select: {
			id: true,
			fileName: true,
			mimeType: true,
			size: true,
			isPublic: true,
		},
	},
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

function formatAttachment(a: {
	id: string;
	createdAt: Date;
	file: {
		id: string;
		fileName: string;
		mimeType: string;
		size: number;
		isPublic: boolean;
	};
}) {
	return {
		id: a.id,
		fileId: a.file.id,
		fileName: a.file.fileName,
		mimeType: a.file.mimeType,
		size: a.file.size,
		isPublic: a.file.isPublic,
		createdAt: a.createdAt,
	};
}

// ─────────────────────────────────────────────────────────────
// POST /committee/inquiries
// お問い合わせを作成（企画側担当者の指定が必須）
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.post(
	"/",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const body = await c.req.json().catch(() => ({}));
		const {
			title,
			body: inquiryBody,
			projectId,
			projectAssigneeUserIds,
			committeeAssigneeUserIds,
			fileIds,
			viewers: viewerInputs,
		} = createCommitteeInquiryRequestSchema.parse(body);

		// 企画の存在チェック
		const project = await prisma.project.findFirst({
			where: { id: projectId, deletedAt: null },
		});
		if (!project) {
			throw Errors.notFound("企画が見つかりません");
		}

		// 企画側担当者が全て企画メンバーかチェック
		const uniqueUserIds = [...new Set(projectAssigneeUserIds)];
		const ownerIds = new Set(
			[project.ownerId, project.subOwnerId].filter(Boolean)
		);
		const nonOwnerIds = uniqueUserIds.filter(id => !ownerIds.has(id));
		if (nonOwnerIds.length > 0) {
			const members = await prisma.projectMember.findMany({
				where: {
					projectId,
					userId: { in: nonOwnerIds },
					deletedAt: null,
				},
				select: { userId: true },
			});
			const memberUserIds = new Set(members.map(m => m.userId));
			if (nonOwnerIds.some(id => !memberUserIds.has(id))) {
				throw Errors.invalidRequest(
					"指定された企画側担当者の中に企画メンバーでないユーザーが含まれています"
				);
			}
		}

		// 追加実委担当者が全て実委人かチェック
		const uniqueCommitteeIds = [
			...new Set((committeeAssigneeUserIds ?? []).filter(id => id !== user.id)),
		];
		if (uniqueCommitteeIds.length > 0) {
			const committeeMembers = await prisma.committeeMember.findMany({
				where: {
					userId: { in: uniqueCommitteeIds },
					deletedAt: null,
				},
				select: { userId: true },
			});
			const committeeMemberUserIds = new Set(
				committeeMembers.map(m => m.userId)
			);
			if (uniqueCommitteeIds.some(id => !committeeMemberUserIds.has(id))) {
				throw Errors.invalidRequest(
					"指定された実委担当者の中に実委人でないユーザーが含まれています"
				);
			}
		}

		// 添付ファイルの存在・ステータスチェック
		const uniqueFileIds = [...new Set(fileIds ?? [])];
		if (uniqueFileIds.length > 0) {
			const files = await prisma.file.findMany({
				where: {
					id: { in: uniqueFileIds },
					uploadedById: user.id,
					status: "CONFIRMED",
					deletedAt: null,
				},
			});
			if (files.length !== uniqueFileIds.length) {
				throw Errors.invalidRequest("指定されたファイルの一部が見つかりません");
			}
		}

		const inquiry = await prisma.inquiry.create({
			data: {
				title,
				body: inquiryBody,
				status: "IN_PROGRESS",
				createdById: user.id,
				creatorRole: "COMMITTEE",
				projectId,
				assignees: {
					create: [
						// 作成者（実委側）
						{ userId: user.id, side: "COMMITTEE", isCreator: true },
						// 企画側担当者
						...uniqueUserIds.map(userId => ({
							userId,
							side: "PROJECT" as const,
							isCreator: false,
						})),
						// 追加実委担当者
						...uniqueCommitteeIds.map(userId => ({
							userId,
							side: "COMMITTEE" as const,
							isCreator: false,
						})),
					],
				},
				attachments: {
					create: uniqueFileIds.map(fileId => ({ fileId })),
				},
				viewers: {
					create: (viewerInputs ?? []).map(input => ({
						scope: input.scope,
						bureauValue: input.bureauValue ?? null,
						userId: input.userId ?? null,
					})),
				},
			},
		});

		notifyInquiryCreatedByCommittee({
			inquiryId: inquiry.id,
			inquiryTitle: title,
			creatorName: user.name,
			projectAssigneeUserIds: uniqueUserIds,
		});

		return c.json({ inquiry }, 201);
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/inquiries
// お問い合わせ一覧（権限に基づくフィルタリング）
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.get("/", requireAuth, requireCommitteeMember, async c => {
	const user = c.get("user");
	const committeeMember = c.get("committeeMember");

	const admin = await isInquiryAdmin(committeeMember.id);

	// 管理者は全件、それ以外はDB側でフィルタリング
	const inquiries = await prisma.inquiry.findMany({
		where: admin
			? { deletedAt: null }
			: {
					deletedAt: null,
					OR: [
						// 実委側担当者として割り当てられている
						{
							assignees: {
								some: {
									userId: user.id,
									side: "COMMITTEE" as const,
									deletedAt: null,
								},
							},
						},
						// 閲覧者: 全員
						{
							viewers: {
								some: { scope: "ALL" as const, deletedAt: null },
							},
						},
						// 閲覧者: 同じ局
						{
							viewers: {
								some: {
									scope: "BUREAU" as const,
									bureauValue: committeeMember.Bureau,
									deletedAt: null,
								},
							},
						},
						// 閲覧者: 個人指定
						{
							viewers: {
								some: {
									scope: "INDIVIDUAL" as const,
									userId: user.id,
									deletedAt: null,
								},
							},
						},
					],
				},
		include: {
			createdBy: { select: userSelect },
			project: { select: { id: true, name: true } },
			assignees: {
				where: { deletedAt: null },
				include: assigneeInclude,
			},
			_count: {
				select: {
					comments: { where: { deletedAt: null } },
				},
			},
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
});

// ─────────────────────────────────────────────────────────────
// GET /committee/inquiries/:inquiryId
// お問い合わせ詳細（閲覧権限チェックあり）
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.get(
	"/:inquiryId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const committeeMember = c.get("committeeMember");
		const { inquiryId } = inquiryIdPathParamsSchema.parse({
			inquiryId: c.req.param("inquiryId"),
		});

		// 閲覧権限チェック
		if (!(await canViewInquiry(inquiryId, user.id, committeeMember))) {
			throw Errors.forbidden("このお問い合わせを閲覧する権限がありません");
		}

		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, deletedAt: null },
			include: {
				createdBy: { select: userSelect },
				project: { select: { id: true, name: true } },
				assignees: {
					where: { deletedAt: null },
					include: assigneeInclude,
				},
				viewers: {
					where: { deletedAt: null },
					include: { user: { select: userSelect } },
				},
				comments: {
					where: { deletedAt: null },
					include: {
						createdBy: { select: userSelect },
						attachments: {
							where: { deletedAt: null },
							include: attachmentInclude,
						},
					},
					orderBy: { createdAt: "asc" },
				},
				activities: {
					where: { deletedAt: null },
					include: {
						actor: { select: userSelect },
						target: { select: userSelect },
					},
					orderBy: { createdAt: "asc" },
				},
				attachments: {
					where: { commentId: null, deletedAt: null },
					include: attachmentInclude,
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
			viewers: inquiry.viewers.map(v => ({
				id: v.id,
				scope: v.scope,
				bureauValue: v.bureauValue,
				createdAt: v.createdAt,
				user: v.user,
			})),
			comments: inquiry.comments.map(cm => ({
				id: cm.id,
				body: cm.body,
				senderRole: cm.senderRole,
				createdAt: cm.createdAt,
				createdBy: cm.createdBy,
				attachments: cm.attachments.map(formatAttachment),
			})),
			activities: inquiry.activities.map(act => ({
				id: act.id,
				type: act.type,
				createdAt: act.createdAt,
				actor: act.actor,
				target: act.target,
			})),
			attachments: inquiry.attachments.map(formatAttachment),
		};

		return c.json({ inquiry: formatted });
	}
);

// ─────────────────────────────────────────────────────────────
// POST /committee/inquiries/:inquiryId/comments
// コメント追加（担当者 or 管理者のみ）
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.post(
	"/:inquiryId/comments",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const committeeMember = c.get("committeeMember");
		const { inquiryId } = inquiryIdPathParamsSchema.parse({
			inquiryId: c.req.param("inquiryId"),
		});
		const body = await c.req.json().catch(() => ({}));
		const { body: commentBody, fileIds } =
			addInquiryCommentRequestSchema.parse(body);

		// 担当者 or 管理者チェック
		await requireAssigneeOrAdmin(inquiryId, user.id, committeeMember);

		// ステータスチェック
		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, deletedAt: null },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}
		if (inquiry.status === "RESOLVED") {
			throw Errors.invalidRequest(
				"解決済みのお問い合わせにはコメントできません"
			);
		}

		// 添付ファイルの存在・ステータスチェック
		const uniqueFileIds = [...new Set(fileIds ?? [])];
		if (uniqueFileIds.length > 0) {
			const files = await prisma.file.findMany({
				where: {
					id: { in: uniqueFileIds },
					uploadedById: user.id,
					status: "CONFIRMED",
					deletedAt: null,
				},
			});
			if (files.length !== uniqueFileIds.length) {
				throw Errors.invalidRequest("指定されたファイルの一部が見つかりません");
			}
		}

		const comment = await prisma.$transaction(async tx => {
			const created = await tx.inquiryComment.create({
				data: {
					inquiryId,
					body: commentBody,
					createdById: user.id,
					senderRole: "COMMITTEE",
				},
				include: { createdBy: { select: userSelect } },
			});

			// 親の updatedAt を更新（一覧の並び順に反映するため）
			await tx.inquiry.update({
				where: { id: inquiryId },
				data: { updatedAt: new Date() },
			});

			let attachments: {
				id: string;
				createdAt: Date;
				file: {
					id: string;
					fileName: string;
					mimeType: string;
					size: number;
					isPublic: boolean;
				};
			}[] = [];

			if (uniqueFileIds.length > 0) {
				await Promise.all(
					uniqueFileIds.map(fileId =>
						tx.inquiryAttachment.create({
							data: {
								inquiryId,
								commentId: created.id,
								fileId,
							},
						})
					)
				);
				attachments = await tx.inquiryAttachment.findMany({
					where: { commentId: created.id, deletedAt: null },
					include: attachmentInclude,
				});
			}

			return { ...created, attachments };
		});

		notifyInquiryCommentAdded({
			inquiryId,
			inquiryTitle: inquiry.title,
			commenterUserId: user.id,
			commenterName: user.name,
			commentBodyPreview: commentBody.slice(0, 200),
		});

		return c.json(
			{
				comment: {
					id: comment.id,
					body: comment.body,
					senderRole: comment.senderRole,
					createdAt: comment.createdAt,
					createdBy: comment.createdBy,
					attachments: comment.attachments.map(formatAttachment),
				},
			},
			201
		);
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /committee/inquiries/:inquiryId/status
// ステータスを解決済みに変更（担当者 or 管理者のみ）
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.patch(
	"/:inquiryId/status",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const committeeMember = c.get("committeeMember");
		const { inquiryId } = inquiryIdPathParamsSchema.parse({
			inquiryId: c.req.param("inquiryId"),
		});
		const body = await c.req.json().catch(() => ({}));
		const { status } = updateInquiryStatusRequestSchema.parse(body);

		// 担当者 or 管理者チェック
		await requireAssigneeOrAdmin(inquiryId, user.id, committeeMember);

		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, deletedAt: null },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}
		if (inquiry.status !== "IN_PROGRESS") {
			throw Errors.invalidRequest("対応中のお問い合わせのみ解決済みにできます");
		}

		const [updated] = await prisma.$transaction([
			prisma.inquiry.update({
				where: { id: inquiryId },
				data: { status },
			}),
			prisma.inquiryActivity.create({
				data: {
					inquiryId,
					type: "STATUS_RESOLVED",
					actorId: user.id,
				},
			}),
		]);

		return c.json({ inquiry: updated });
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /committee/inquiries/:inquiryId/reopen
// 再オープン（RESOLVED → IN_PROGRESS）（担当者 or 管理者のみ）
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.patch(
	"/:inquiryId/reopen",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const committeeMember = c.get("committeeMember");
		const { inquiryId } = inquiryIdPathParamsSchema.parse({
			inquiryId: c.req.param("inquiryId"),
		});

		// 担当者 or 管理者チェック
		await requireAssigneeOrAdmin(inquiryId, user.id, committeeMember);

		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, deletedAt: null },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}
		if (inquiry.status !== "RESOLVED") {
			throw Errors.invalidRequest(
				"解決済みのお問い合わせのみ再オープンできます"
			);
		}

		// 実委側担当者がいれば IN_PROGRESS、いなければ UNASSIGNED
		const committeeAssigneeCount = await prisma.inquiryAssignee.count({
			where: { inquiryId, side: "COMMITTEE", deletedAt: null },
		});
		const newStatus = committeeAssigneeCount > 0 ? "IN_PROGRESS" : "UNASSIGNED";

		const [updated] = await prisma.$transaction([
			prisma.inquiry.update({
				where: { id: inquiryId },
				data: { status: newStatus },
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
// POST /committee/inquiries/:inquiryId/assignees
// 担当者追加（担当者 or 管理者のみ）
// 実委側担当者追加時に UNASSIGNED → IN_PROGRESS 自動遷移
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.post(
	"/:inquiryId/assignees",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const committeeMember = c.get("committeeMember");
		const { inquiryId } = inquiryIdPathParamsSchema.parse({
			inquiryId: c.req.param("inquiryId"),
		});
		const body = await c.req.json().catch(() => ({}));
		const { userId, side } = addInquiryAssigneeRequestSchema.parse(body);

		// 担当者 or 管理者チェック
		await requireAssigneeOrAdmin(inquiryId, user.id, committeeMember);

		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, deletedAt: null },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}

		// 既に担当者かチェック
		const existing = await prisma.inquiryAssignee.findFirst({
			where: { inquiryId, userId, deletedAt: null },
		});
		if (existing) {
			throw Errors.alreadyExists("既に担当者です");
		}

		// 企画側担当者の場合は対象企画のメンバーかチェック
		if (side === "PROJECT") {
			const project = await prisma.project.findFirst({
				where: { id: inquiry.projectId, deletedAt: null },
			});
			if (!project) {
				throw Errors.notFound("企画が見つかりません");
			}
			const isOwner = project.ownerId === userId;
			const isSubOwner = project.subOwnerId === userId;
			const isMember = await prisma.projectMember.findFirst({
				where: { projectId: inquiry.projectId, userId, deletedAt: null },
			});
			if (!isOwner && !isSubOwner && !isMember) {
				throw Errors.invalidRequest(
					"対象ユーザーはこの企画のメンバーではありません"
				);
			}
		}

		// 実委側担当者の場合は実委人かチェック
		if (side === "COMMITTEE") {
			const targetMember = await prisma.committeeMember.findFirst({
				where: { userId, deletedAt: null },
			});
			if (!targetMember) {
				throw Errors.invalidRequest("対象ユーザーは実委人ではありません");
			}
		}

		const assignee = await prisma.$transaction(async tx => {
			const created = await tx.inquiryAssignee.create({
				data: { inquiryId, userId, side, isCreator: false },
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

			// 実委側担当者追加時に UNASSIGNED → IN_PROGRESS 自動遷移
			if (side === "COMMITTEE" && inquiry.status === "UNASSIGNED") {
				await tx.inquiry.update({
					where: { id: inquiryId },
					data: { status: "IN_PROGRESS" },
				});
			}

			return created;
		});

		notifyInquiryAssigneeAdded({
			addedUserId: userId,
			inquiryId,
			inquiryTitle: inquiry.title,
			side,
		});

		return c.json({ assignee: formatAssignee(assignee) }, 201);
	}
);

// ─────────────────────────────────────────────────────────────
// DELETE /committee/inquiries/:inquiryId/assignees/:assigneeId
// 担当者削除（担当者 or 管理者のみ、作成者は削除不可）
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.delete(
	"/:inquiryId/assignees/:assigneeId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const committeeMember = c.get("committeeMember");
		const { inquiryId, assigneeId } =
			committeeInquiryAssigneeIdPathParamsSchema.parse({
				inquiryId: c.req.param("inquiryId"),
				assigneeId: c.req.param("assigneeId"),
			});

		// 担当者 or 管理者チェック
		await requireAssigneeOrAdmin(inquiryId, user.id, committeeMember);

		const assignee = await prisma.inquiryAssignee.findFirst({
			where: { id: assigneeId, inquiryId, deletedAt: null },
		});
		if (!assignee) {
			throw Errors.notFound("担当者が見つかりません");
		}
		if (assignee.isCreator) {
			throw Errors.invalidRequest("作成者は担当者から削除できません");
		}

		await prisma.$transaction(async tx => {
			await tx.inquiryAssignee.update({
				where: { id: assigneeId },
				data: { deletedAt: new Date() },
			});

			await tx.inquiryActivity.create({
				data: {
					inquiryId,
					type: "ASSIGNEE_REMOVED",
					actorId: user.id,
					targetId: assignee.userId,
				},
			});

			// 実委側担当者が0人になったら IN_PROGRESS → UNASSIGNED に自動遷移
			if (assignee.side === "COMMITTEE") {
				const remainingCommittee = await tx.inquiryAssignee.count({
					where: {
						inquiryId,
						side: "COMMITTEE",
						deletedAt: null,
					},
				});
				if (remainingCommittee === 0) {
					const inquiry = await tx.inquiry.findFirstOrThrow({
						where: { id: inquiryId },
					});
					if (inquiry.status === "IN_PROGRESS") {
						await tx.inquiry.update({
							where: { id: inquiryId },
							data: { status: "UNASSIGNED" },
						});
					}
				}
			}
		});

		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────────────────────────
// PUT /committee/inquiries/:inquiryId/viewers
// 閲覧者設定（担当者 or 管理者のみ）
// 既存の閲覧者を全削除して新規作成
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.put(
	"/:inquiryId/viewers",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const committeeMember = c.get("committeeMember");
		const { inquiryId } = inquiryIdPathParamsSchema.parse({
			inquiryId: c.req.param("inquiryId"),
		});
		const body = await c.req.json().catch(() => ({}));
		const { viewers: viewerInputs } =
			updateInquiryViewersRequestSchema.parse(body);

		// 担当者 or 管理者チェック
		await requireAssigneeOrAdmin(inquiryId, user.id, committeeMember);

		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, deletedAt: null },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}

		// トランザクションで全削除→新規作成
		const viewers = await prisma.$transaction(async tx => {
			// 既存の閲覧者を全削除
			await tx.inquiryViewer.deleteMany({ where: { inquiryId } });

			// 新規作成
			const created = await Promise.all(
				viewerInputs.map(input =>
					tx.inquiryViewer.create({
						data: {
							inquiryId,
							scope: input.scope,
							bureauValue: input.bureauValue ?? null,
							userId: input.userId ?? null,
						},
						include: { user: { select: userSelect } },
					})
				)
			);

			// アクティビティ記録
			await tx.inquiryActivity.create({
				data: {
					inquiryId,
					type: "VIEWER_UPDATED",
					actorId: user.id,
				},
			});

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

export { committeeInquiryRoute };
