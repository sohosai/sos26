import type { CommitteeMember } from "@prisma/client";
import {
	addInquiryAssigneeRequestSchema,
	addInquiryCommentRequestSchema,
	committeeInquiryAssigneeIdPathParamsSchema,
	createCommitteeInquiryRequestSchema,
	inquiryCommentIdPathParamsSchema,
	inquiryIdPathParamsSchema,
	updateDraftCommentRequestSchema,
	updateDraftInquiryRequestSchema,
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
import { getUserAffiliations } from "../lib/user-affiliation";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeInquiryRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// ヘルパー: 関連申請の検証（オーナーまたは共同編集者のみ選択可）
// ─────────────────────────────────────────────────────────────

async function validateRelatedForm(
	formId: string,
	userId: string
): Promise<void> {
	const form = await prisma.form.findFirst({
		where: {
			id: formId,
			deletedAt: null,
			OR: [
				{ ownerId: userId },
				{ collaborators: { some: { userId, deletedAt: null } } },
			],
		},
	});
	if (!form) {
		throw Errors.invalidRequest("指定された申請が見つかりません");
	}
}

async function validateProjectAssignees(
	projectId: string,
	projectAssigneeUserIds: string[]
): Promise<void> {
	const project = await prisma.project.findFirst({
		where: { id: projectId, deletedAt: null },
	});
	if (!project) {
		throw Errors.notFound("企画が見つかりません");
	}

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
}

async function validateCommitteeAssignees(
	committeeAssigneeUserIds: string[]
): Promise<void> {
	const uniqueCommitteeIds = [
		...new Set(committeeAssigneeUserIds.filter(id => id)),
	];
	if (uniqueCommitteeIds.length > 0) {
		const committeeMembers = await prisma.committeeMember.findMany({
			where: {
				userId: { in: uniqueCommitteeIds },
				deletedAt: null,
			},
			select: { userId: true },
		});
		const committeeMemberUserIds = new Set(committeeMembers.map(m => m.userId));
		if (uniqueCommitteeIds.some(id => !committeeMemberUserIds.has(id))) {
			throw Errors.invalidRequest(
				"指定された実委担当者の中に実委人でないユーザーが含まれています"
			);
		}
	}
}

async function validateAttachments(
	fileIds: string[],
	userId: string
): Promise<void> {
	const uniqueFileIds = [...new Set(fileIds ?? [])];
	if (uniqueFileIds.length > 0) {
		const files = await prisma.file.findMany({
			where: {
				id: { in: uniqueFileIds },
				uploadedById: userId,
				status: "CONFIRMED",
				deletedAt: null,
			},
		});
		if (files.length !== uniqueFileIds.length) {
			throw Errors.invalidRequest("指定されたファイルの一部が見つかりません");
		}
	}
}

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

function getCommentSentAt(comment: { createdAt: Date; sentAt: Date | null }) {
	return comment.sentAt ?? comment.createdAt;
}

type UserAffiliation = {
	committeeBureau?: string;
	affiliatedProjects: string[];
};

function withAffiliation(
	user: { id: string; name: string },
	affiliations: Map<string, UserAffiliation>
) {
	const aff = affiliations.get(user.id) ?? { affiliatedProjects: [] };
	return {
		...user,
		committeeBureau: aff.committeeBureau,
		affiliatedProjects: aff.affiliatedProjects,
	};
}

function withAffiliationNullable(
	user: { id: string; name: string } | null,
	affiliations: Map<string, UserAffiliation>
) {
	return user ? withAffiliation(user, affiliations) : null;
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
			relatedFormId,
			projectId,
			projectAssigneeUserIds,
			committeeAssigneeUserIds,
			fileIds,
			viewers: viewerInputs,
			isDraft,
		} = createCommitteeInquiryRequestSchema.parse(body);

		await validateProjectAssignees(projectId, projectAssigneeUserIds);
		await validateCommitteeAssignees(committeeAssigneeUserIds ?? []);
		await validateAttachments(fileIds ?? [], user.id);

		// 関連申請の検証（オーナーまたは共同編集者のみ）
		if (relatedFormId) {
			await validateRelatedForm(relatedFormId, user.id);
		}

		const uniqueUserIds = [...new Set(projectAssigneeUserIds)];
		const uniqueCommitteeIds = [
			...new Set((committeeAssigneeUserIds ?? []).filter(id => id !== user.id)),
		];
		const uniqueFileIds = [...new Set(fileIds ?? [])];

		const inquiry = await prisma.inquiry.create({
			data: {
				title,
				body: inquiryBody,
				status: "IN_PROGRESS",
				createdById: user.id,
				creatorRole: "COMMITTEE",
				projectId,
				relatedFormId,
				isDraft: isDraft ?? false,
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

		if (!isDraft) {
			void notifyInquiryCreatedByCommittee({
				inquiryId: inquiry.id,
				inquiryTitle: title,
				creatorName: user.name,
				projectAssigneeUserIds: uniqueUserIds,
			});
		}

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
			comments: {
				where: {
					deletedAt: null,
					isDraft: false,
					senderRole: "PROJECT",
				},
				select: { createdAt: true, sentAt: true },
				orderBy: [
					{ sentAt: { sort: "desc", nulls: "last" } },
					{ createdAt: "desc" },
				],
				take: 1,
			},
			commentReadStatuses: {
				where: { userId: user.id },
				select: { lastReadAt: true },
				take: 1,
			},
			_count: {
				select: {
					comments: { where: { deletedAt: null, isDraft: false } },
				},
			},
		},
		orderBy: { updatedAt: "desc" },
	});

	const formatted = inquiries.map(inq => {
		const latestProjectComment = inq.comments[0] ?? null;
		const latestProjectCommentAt = latestProjectComment
			? getCommentSentAt(latestProjectComment)
			: null;
		const lastReadAt = inq.commentReadStatuses[0]?.lastReadAt ?? null;

		return {
			id: inq.id,
			title: inq.title,
			status: inq.status,
			creatorRole: inq.creatorRole,
			createdAt: inq.createdAt,
			updatedAt: inq.updatedAt,
			isDraft: inq.isDraft,
			hasUnreadComments: latestProjectCommentAt
				? !lastReadAt || latestProjectCommentAt.getTime() > lastReadAt.getTime()
				: false,
			createdBy: inq.createdBy,
			project: inq.project,
			projectAssignees: inq.assignees
				.filter(a => a.side === "PROJECT")
				.map(formatAssignee),
			committeeAssignees: inq.assignees
				.filter(a => a.side === "COMMITTEE")
				.map(formatAssignee),
			commentCount: inq._count.comments,
		};
	});

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
				relatedForm: { select: { id: true, title: true } },
				assignees: {
					where: { deletedAt: null },
					include: assigneeInclude,
				},
				viewers: {
					where: { deletedAt: null },
					include: { user: { select: userSelect } },
				},
				comments: {
					where: {
						deletedAt: null,
					},
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

		// 全ユーザーIDを収集して所属情報を一括取得
		const allUserIds = [
			inquiry.createdBy.id,
			...inquiry.assignees.map(a => a.user.id),
			...inquiry.comments.map(cm => cm.createdBy.id),
			...inquiry.activities.map(act => act.actor.id),
			...inquiry.activities.flatMap(act => (act.target ? [act.target.id] : [])),
			...inquiry.viewers.flatMap(v => (v.user ? [v.user.id] : [])),
		];
		const affiliations = await getUserAffiliations(allUserIds);

		// コメントを整形し、通常コメントの後に下書きを表示する
		const formattedComments = inquiry.comments.map(cm => ({
			id: cm.id,
			body: cm.body,
			senderRole: cm.senderRole,
			isDraft: cm.isDraft,
			createdAt: cm.createdAt,
			sentAt: cm.sentAt,
			createdBy: withAffiliation(cm.createdBy, affiliations),
			attachments: cm.attachments.map(formatAttachment),
		}));

		// 通常のコメント（isDraft: false）と下書き（isDraft: true）に分離
		const regularComments = formattedComments.filter(cm => !cm.isDraft);
		const draftComments = formattedComments.filter(cm => cm.isDraft);

		// 通常コメントは送信時刻でソート（既存データは createdAt をフォールバック）
		regularComments.sort(
			(a, b) => getCommentSentAt(a).getTime() - getCommentSentAt(b).getTime()
		);

		// 下書きもcreatedAtでソート（複数の下書きがある場合のため）
		draftComments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

		// 通常コメントの後に下書きを追加
		const sortedComments = [...regularComments, ...draftComments];

		const formatted = {
			id: inquiry.id,
			title: inquiry.title,
			body: inquiry.body,
			status: inquiry.status,
			createdById: inquiry.createdById,
			creatorRole: inquiry.creatorRole,
			projectId: inquiry.projectId,
			relatedFormId: inquiry.relatedFormId,
			isDraft: inquiry.isDraft,
			createdAt: inquiry.createdAt,
			updatedAt: inquiry.updatedAt,
			createdBy: withAffiliation(inquiry.createdBy, affiliations),
			project: inquiry.project,
			relatedForm: inquiry.relatedForm,
			projectAssignees: inquiry.assignees
				.filter(a => a.side === "PROJECT")
				.map(a => ({
					...formatAssignee(a),
					user: withAffiliation(a.user, affiliations),
				})),
			committeeAssignees: inquiry.assignees
				.filter(a => a.side === "COMMITTEE")
				.map(a => ({
					...formatAssignee(a),
					user: withAffiliation(a.user, affiliations),
				})),
			viewers: inquiry.viewers.map(v => ({
				id: v.id,
				scope: v.scope,
				bureauValue: v.bureauValue,
				createdAt: v.createdAt,
				user: withAffiliationNullable(v.user, affiliations),
			})),
			comments: sortedComments,
			activities: inquiry.activities.map(act => ({
				id: act.id,
				type: act.type,
				createdAt: act.createdAt,
				actor: withAffiliation(act.actor, affiliations),
				target: withAffiliationNullable(act.target, affiliations),
			})),
			attachments: inquiry.attachments.map(formatAttachment),
		};

		await prisma.inquiryCommentReadStatus.upsert({
			where: {
				inquiryId_userId: {
					inquiryId,
					userId: user.id,
				},
			},
			create: {
				inquiryId,
				userId: user.id,
				lastReadAt: new Date(),
			},
			update: {
				lastReadAt: new Date(),
			},
		});

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
		const {
			body: commentBody,
			fileIds,
			isDraft,
		} = addInquiryCommentRequestSchema.parse(body);

		// 担当者 or 管理者チェック
		await requireAssigneeOrAdmin(inquiryId, user.id, committeeMember);

		// ステータスチェック
		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, deletedAt: null },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}
		if (inquiry.isDraft) {
			throw Errors.invalidRequest(
				"下書き状態のお問い合わせにはコメントできません"
			);
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
					isDraft: isDraft ?? false,
					sentAt: isDraft ? null : new Date(),
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

		// 下書きでない場合のみ通知を送信
		if (!isDraft) {
			void notifyInquiryCommentAdded({
				inquiryId,
				inquiryTitle: inquiry.title,
				commenterUserId: user.id,
				commenterName: user.name,
				commentBodyPreview: commentBody.slice(0, 200),
			});
		}

		return c.json(
			{
				comment: {
					id: comment.id,
					body: comment.body,
					senderRole: comment.senderRole,
					isDraft: comment.isDraft,
					createdAt: comment.createdAt,
					sentAt: comment.sentAt,
					createdBy: comment.createdBy,
					attachments: comment.attachments.map(formatAttachment),
				},
			},
			201
		);
	}
);

// ─────────────────────────────────────────────────────────────
// POST /committee/inquiries/:inquiryId/comments/:commentId/publish
// 下書きコメントを正式送信（作成者のみ）
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.post(
	"/:inquiryId/comments/:commentId/publish",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { inquiryId, commentId } = {
			inquiryId: c.req.param("inquiryId"),
			commentId: c.req.param("commentId"),
		};

		// コメントの存在と下書き状態を確認
		const existingComment = await prisma.inquiryComment.findFirst({
			where: {
				id: commentId,
				inquiryId,
				deletedAt: null,
			},
			include: {
				inquiry: true,
				createdBy: { select: userSelect },
			},
		});

		if (!existingComment) {
			throw Errors.notFound("コメントが見つかりません");
		}

		if (!existingComment.isDraft) {
			throw Errors.invalidRequest("このコメントは既に送信済みです");
		}

		// 作成者のみが送信可能
		if (existingComment.createdById !== user.id) {
			throw Errors.forbidden("下書きの送信は作成者のみが可能です");
		}

		// お問い合わせがRESOLVED状態でないことを確認
		if (existingComment.inquiry.status === "RESOLVED") {
			throw Errors.invalidRequest(
				"解決済みのお問い合わせにはコメントできません"
			);
		}

		// 下書きを正式送信に変換（送信時刻をコメント時刻として確定）
		const comment = await prisma.$transaction(async tx => {
			const publishedAt = new Date();
			const updated = await tx.inquiryComment.update({
				where: { id: commentId },
				data: {
					isDraft: false,
					sentAt: publishedAt,
				},
				include: { createdBy: { select: userSelect } },
			});

			// 親の updatedAt を更新
			await tx.inquiry.update({
				where: { id: inquiryId },
				data: { updatedAt: publishedAt },
			});

			// 添付ファイルを取得
			const attachments = await tx.inquiryAttachment.findMany({
				where: { commentId: updated.id, deletedAt: null },
				include: attachmentInclude,
			});

			return { ...updated, attachments };
		});

		// 通知を送信
		void notifyInquiryCommentAdded({
			inquiryId,
			inquiryTitle: existingComment.inquiry.title,
			commenterUserId: user.id,
			commenterName: user.name,
			commentBodyPreview: comment.body.slice(0, 200),
		});

		return c.json({
			comment: {
				id: comment.id,
				body: comment.body,
				senderRole: comment.senderRole,
				isDraft: comment.isDraft,
				createdAt: comment.createdAt,
				sentAt: comment.sentAt,
				createdBy: comment.createdBy,
				attachments: comment.attachments.map(formatAttachment),
			},
		});
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /committee/inquiries/:inquiryId/comments/:commentId
// 下書きコメントを更新（作成者のみ）
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.patch(
	"/:inquiryId/comments/:commentId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { inquiryId, commentId } = inquiryCommentIdPathParamsSchema.parse({
			inquiryId: c.req.param("inquiryId"),
			commentId: c.req.param("commentId"),
		});
		const body = await c.req.json().catch(() => ({}));
		const { body: draftBody } = updateDraftCommentRequestSchema.parse(body);

		const existingComment = await prisma.inquiryComment.findFirst({
			where: {
				id: commentId,
				inquiryId,
				deletedAt: null,
			},
			include: {
				inquiry: true,
				createdBy: { select: userSelect },
			},
		});
		if (!existingComment) {
			throw Errors.notFound("コメントが見つかりません");
		}
		if (!existingComment.isDraft) {
			throw Errors.invalidRequest("送信済みコメントは編集できません");
		}
		if (existingComment.createdById !== user.id) {
			throw Errors.forbidden("下書きの編集は作成者のみが可能です");
		}
		if (existingComment.inquiry.status === "RESOLVED") {
			throw Errors.invalidRequest(
				"解決済みのお問い合わせにはコメントできません"
			);
		}

		const comment = await prisma.$transaction(async tx => {
			const now = new Date();
			const updated = await tx.inquiryComment.update({
				where: { id: commentId },
				data: { body: draftBody },
				include: { createdBy: { select: userSelect } },
			});
			await tx.inquiry.update({
				where: { id: inquiryId },
				data: { updatedAt: now },
			});
			const attachments = await tx.inquiryAttachment.findMany({
				where: { commentId: updated.id, deletedAt: null },
				include: attachmentInclude,
			});
			return { ...updated, attachments };
		});

		return c.json({
			comment: {
				id: comment.id,
				body: comment.body,
				senderRole: comment.senderRole,
				isDraft: comment.isDraft,
				createdAt: comment.createdAt,
				sentAt: comment.sentAt,
				createdBy: comment.createdBy,
				attachments: comment.attachments.map(formatAttachment),
			},
		});
	}
);

// ─────────────────────────────────────────────────────────────
// DELETE /committee/inquiries/:inquiryId/comments/:commentId
// コメントを削除（下書きは作成者のみ、通常コメントは管理者または作成者）
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.delete(
	"/:inquiryId/comments/:commentId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const committeeMember = c.get("committeeMember");
		const { inquiryId, commentId } = {
			inquiryId: c.req.param("inquiryId"),
			commentId: c.req.param("commentId"),
		};

		// コメントの存在確認
		const existingComment = await prisma.inquiryComment.findFirst({
			where: {
				id: commentId,
				inquiryId,
				deletedAt: null,
			},
		});

		if (!existingComment) {
			throw Errors.notFound("コメントが見つかりません");
		}

		// 権限チェック
		if (existingComment.isDraft) {
			// 下書きの場合: 作成者のみ削除可能
			if (existingComment.createdById !== user.id) {
				throw Errors.forbidden("下書きの削除は作成者のみが可能です");
			}
		} else {
			// 通常コメントの場合: 管理者または作成者
			const isAdmin = await isInquiryAdmin(committeeMember.id);
			const isCreator = existingComment.createdById === user.id;
			if (!isAdmin && !isCreator) {
				throw Errors.forbidden("このコメントを削除する権限がありません");
			}
		}

		// 論理削除
		await prisma.inquiryComment.update({
			where: { id: commentId },
			data: { deletedAt: new Date() },
		});

		return c.json({ success: true as const });
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

		void notifyInquiryAssigneeAdded({
			addedUserId: userId,
			inquiryId,
			inquiryTitle: inquiry.title,
			side,
		});

		return c.json(
			{
				assignee: {
					...formatAssignee(assignee),
				},
			},
			201
		);
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

// ─────────────────────────────────────────────────────────────
// PATCH /:inquiryId (下書きお問い合わせの編集)
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.patch(
	"/:inquiryId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { inquiryId } = inquiryIdPathParamsSchema.parse({
			inquiryId: c.req.param("inquiryId"),
		});
		const body = await c.req.json().catch(() => ({}));
		const {
			title,
			body: inquiryBody,
			fileIds,
		} = updateDraftInquiryRequestSchema.parse(body);

		// 下書きの存在確認
		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, deletedAt: null },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}
		if (!inquiry.isDraft) {
			throw Errors.invalidRequest("下書き状態のお問い合わせのみ編集可能です");
		}

		// 作成者本人のみ編集可能
		if (inquiry.createdById !== user.id) {
			throw Errors.forbidden("下書きの作成者のみが編集できます");
		}

		// 更新
		const uniqueFileIds = fileIds ? [...new Set(fileIds)] : null;
		if (uniqueFileIds && uniqueFileIds.length > 0) {
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

		const updateData: {
			title?: string;
			body?: string;
			updatedAt: Date;
		} = { updatedAt: new Date() };
		if (title !== undefined) updateData.title = title;
		if (inquiryBody !== undefined) updateData.body = inquiryBody;

		const updated = await prisma.$transaction(async tx => {
			const updatedInquiry = await tx.inquiry.update({
				where: { id: inquiryId },
				data: updateData,
			});

			if (uniqueFileIds) {
				const existingAttachments = await tx.inquiryAttachment.findMany({
					where: { inquiryId, commentId: null, deletedAt: null },
					select: { id: true, fileId: true },
				});
				const desiredFileIds = new Set(uniqueFileIds);
				const existingFileIds = new Set(existingAttachments.map(a => a.fileId));
				const removeIds = existingAttachments
					.filter(a => !desiredFileIds.has(a.fileId))
					.map(a => a.id);
				const addFileIds = uniqueFileIds.filter(
					fileId => !existingFileIds.has(fileId)
				);

				if (removeIds.length > 0) {
					await tx.inquiryAttachment.updateMany({
						where: { id: { in: removeIds } },
						data: { deletedAt: new Date() },
					});
				}
				if (addFileIds.length > 0) {
					await tx.inquiryAttachment.createMany({
						data: addFileIds.map(fileId => ({ inquiryId, fileId })),
					});
				}
			}

			return updatedInquiry;
		});

		return c.json({
			inquiry: updated,
		});
	}
);

// ─────────────────────────────────────────────────────────────
// POST /:inquiryId/publish (下書きお問い合わせの送信)
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.post(
	"/:inquiryId/publish",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { inquiryId } = inquiryIdPathParamsSchema.parse({
			inquiryId: c.req.param("inquiryId"),
		});

		// 下書きの存在確認
		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, deletedAt: null },
			include: {
				assignees: {
					where: { side: "PROJECT", deletedAt: null },
					include: { user: true },
				},
			},
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}
		if (!inquiry.isDraft) {
			throw Errors.invalidRequest("下書き状態のお問い合わせのみ送信可能です");
		}

		// 作成者本人のみ送信可能
		if (inquiry.createdById !== user.id) {
			throw Errors.forbidden("下書きの作成者のみが送信できます");
		}

		// 送信（isDraft を false に更新）
		const published = await prisma.$transaction(async tx => {
			const updated = await tx.inquiry.update({
				where: { id: inquiryId },
				data: {
					isDraft: false,
					updatedAt: new Date(),
				},
			});

			// アクティビティ記録
			return updated;
		});

		// 企画側担当者に通知
		const projectAssigneeUserIds = inquiry.assignees.map(a => a.userId);
		void notifyInquiryCreatedByCommittee({
			inquiryId: published.id,
			inquiryTitle: published.title,
			creatorName: user.name,
			projectAssigneeUserIds,
		});

		return c.json({
			inquiry: published,
		});
	}
);

// ─────────────────────────────────────────────────────────────
// DELETE /:inquiryId (下書きお問い合わせの削除)
// ─────────────────────────────────────────────────────────────
committeeInquiryRoute.delete(
	"/:inquiryId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { inquiryId } = inquiryIdPathParamsSchema.parse({
			inquiryId: c.req.param("inquiryId"),
		});

		// 下書きの存在確認
		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, deletedAt: null },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}
		if (!inquiry.isDraft) {
			throw Errors.invalidRequest("下書き状態のお問い合わせのみ削除可能です");
		}

		// 作成者本人のみ削除可能
		if (inquiry.createdById !== user.id) {
			throw Errors.forbidden("下書きの作成者のみが削除できます");
		}

		// 論理削除
		await prisma.inquiry.update({
			where: { id: inquiryId },
			data: {
				deletedAt: new Date(),
			},
		});

		return c.json({ success: true });
	}
);

export { committeeInquiryRoute };
