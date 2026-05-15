import {
	addInquiryAssigneeRequestSchema,
	addInquiryCommentRequestSchema,
	createProjectInquiryRequestSchema,
	projectInquiryAssigneeIdPathParamsSchema,
	projectInquiryIdPathParamsSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import {
	notifyInquiryAssigneeAdded,
	notifyInquiryCommentAdded,
	notifyInquiryCreatedByProject,
} from "../lib/notifications";
import { prisma } from "../lib/prisma";
import {
	getUserAffiliations,
	withAffiliation,
	withAffiliationNullable,
} from "../lib/user-affiliation";
import { requireAuth, requireProjectMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const projectInquiryRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// ヘルパー: 関連申請の検証と初期対応ルール
// ─────────────────────────────────────────────────────────────

type FormInitialAssignment = {
	formOwnerId: string | null;
	formCollaboratorIds: string[];
};

async function resolveRelatedForm(
	relatedFormId: string | undefined,
	projectId: string
): Promise<FormInitialAssignment> {
	if (!relatedFormId) {
		return { formOwnerId: null, formCollaboratorIds: [] };
	}
	const delivery = await prisma.formDelivery.findFirst({
		where: {
			projectId,
			formAuthorization: {
				form: { id: relatedFormId, deletedAt: null },
			},
		},
		include: {
			formAuthorization: {
				include: {
					form: {
						include: {
							collaborators: {
								where: { deletedAt: null },
								select: { userId: true },
							},
						},
					},
				},
			},
		},
	});
	if (!delivery) {
		throw Errors.invalidRequest("指定された申請はこの企画に配信されていません");
	}
	const formOwnerId = delivery.formAuthorization.form.ownerId;
	const formCollaboratorIds = delivery.formAuthorization.form.collaborators
		.map(c => c.userId)
		.filter(id => id !== formOwnerId);
	return { formOwnerId, formCollaboratorIds };
}

// ─────────────────────────────────────────────────────────────
// ヘルパー: 申請紐づけ時の初期アサイン・閲覧者を構築
// （企画側担当者と重複するユーザーは除外）
// ─────────────────────────────────────────────────────────────

function buildFormAssignments(
	formOwnerId: string | null,
	formCollaboratorIds: string[],
	projectSideUserIds: Set<string>
) {
	const effectiveOwnerId =
		formOwnerId && !projectSideUserIds.has(formOwnerId) ? formOwnerId : null;

	const committeeAssignees = effectiveOwnerId
		? [
				{
					userId: effectiveOwnerId,
					side: "COMMITTEE" as const,
					isCreator: false,
				},
			]
		: [];

	const initialViewers = formCollaboratorIds
		.filter(id => !projectSideUserIds.has(id))
		.map(userId => ({
			scope: "INDIVIDUAL" as const,
			bureauValue: null,
			userId,
		}));

	return {
		effectiveOwnerId,
		initialStatus: effectiveOwnerId
			? ("IN_PROGRESS" as const)
			: ("UNASSIGNED" as const),
		committeeAssignees,
		initialViewers,
	};
}

// ─────────────────────────────────────────────────────────────
// ヘルパー: 企画側担当者チェック
// ─────────────────────────────────────────────────────────────

async function requireProjectAssignee(inquiryId: string, userId: string) {
	const assignee = await prisma.inquiryAssignee.findFirst({
		where: { inquiryId, userId, side: "PROJECT", deletedAt: null },
	});
	if (!assignee) {
		throw Errors.forbidden("このお問い合わせの担当者ではありません");
	}
	return assignee;
}

// ─────────────────────────────────────────────────────────────
// レスポンス整形ヘルパー
// ─────────────────────────────────────────────────────────────

const userSelect = { id: true, name: true, avatarFileId: true } as const;

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

function formatAssignee(a: {
	id: string;
	side: string;
	isCreator: boolean;
	assignedAt: Date;
	user: { id: string; name: string; avatarFileId: string | null };
}) {
	return {
		id: a.id,
		side: a.side,
		isCreator: a.isCreator,
		assignedAt: a.assignedAt,
		user: a.user,
	};
}

function getCommentSentAt(comment: { createdAt: Date; sentAt: Date | null }) {
	return comment.sentAt ?? comment.createdAt;
}

function getLatestCommitteeActivityAt(inquiry: {
	sentAt: Date | null;
	creatorRole: "PROJECT" | "COMMITTEE";
	createdAt: Date;
	comments: Array<{ createdAt: Date; sentAt: Date | null }>;
}) {
	const latestCommitteeComment = inquiry.comments[0] ?? null;
	const latestCommitteeCommentAt = latestCommitteeComment
		? getCommentSentAt(latestCommitteeComment)
		: null;
	const committeeCreatedAt =
		inquiry.creatorRole === "COMMITTEE"
			? (inquiry.sentAt ?? inquiry.createdAt)
			: null;

	if (latestCommitteeCommentAt && committeeCreatedAt) {
		return latestCommitteeCommentAt.getTime() > committeeCreatedAt.getTime()
			? latestCommitteeCommentAt
			: committeeCreatedAt;
	}

	return latestCommitteeCommentAt ?? committeeCreatedAt;
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
		const {
			title,
			body: inquiryBody,
			relatedFormId,
			coAssigneeUserIds,
			fileIds,
		} = createProjectInquiryRequestSchema.parse(body);

		// 共同担当者が全て企画メンバーかチェック
		const uniqueCoAssigneeIds = [
			...new Set((coAssigneeUserIds ?? []).filter(id => id !== user.id)),
		];
		if (uniqueCoAssigneeIds.length > 0) {
			const ownerIds = new Set(
				[project.ownerId, project.subOwnerId].filter(Boolean)
			);
			const nonOwnerIds = uniqueCoAssigneeIds.filter(id => !ownerIds.has(id));
			if (nonOwnerIds.length > 0) {
				const members = await prisma.projectMember.findMany({
					where: {
						projectId: project.id,
						userId: { in: nonOwnerIds },
						deletedAt: null,
					},
					select: { userId: true },
				});
				const memberUserIds = new Set(members.map(m => m.userId));
				if (nonOwnerIds.some(id => !memberUserIds.has(id))) {
					throw Errors.invalidRequest(
						"指定された共同担当者の中に企画メンバーでないユーザーが含まれています"
					);
				}
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

		// 関連申請の検証と初期対応ルール
		const { formOwnerId, formCollaboratorIds } = await resolveRelatedForm(
			relatedFormId,
			project.id
		);
		const {
			effectiveOwnerId,
			initialStatus,
			committeeAssignees,
			initialViewers,
		} = buildFormAssignments(
			formOwnerId,
			formCollaboratorIds,
			new Set([user.id, ...uniqueCoAssigneeIds])
		);

		const inquiry = await prisma.inquiry.create({
			data: {
				title,
				body: inquiryBody,
				status: initialStatus,
				createdById: user.id,
				creatorRole: "PROJECT",
				projectId: project.id,
				relatedFormId,
				sentAt: new Date(),
				assignees: {
					create: [
						{ userId: user.id, side: "PROJECT", isCreator: true },
						...uniqueCoAssigneeIds.map(id => ({
							userId: id,
							side: "PROJECT" as const,
							isCreator: false,
						})),
						...committeeAssignees,
					],
				},
				attachments: {
					create: uniqueFileIds.map(fileId => ({ fileId })),
				},
				viewers: {
					create: initialViewers,
				},
			},
		});

		void notifyInquiryCreatedByProject({
			inquiryId: inquiry.id,
			inquiryTitle: title,
			projectName: project.name,
			creatorName: user.name,
		});

		// 申請紐づけで自動追加された実委担当者（申請オーナー）に通知
		if (effectiveOwnerId) {
			void notifyInquiryAssigneeAdded({
				addedUserId: effectiveOwnerId,
				inquiryId: inquiry.id,
				inquiryTitle: title,
				side: "COMMITTEE",
			});
		}

		return c.json({ inquiry }, 201);
	}
);

// ─────────────────────────────────────────────────────────────
// GET /project/:projectId/inquiries
// 企画メンバーが閲覧可能なお問い合わせ一覧
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
				deletedAt: null,
				isDraft: false,
				assignees: {
					some: { userId: user.id, side: "PROJECT", deletedAt: null },
				},
			},
			include: {
				createdBy: { select: userSelect },
				project: { select: { id: true, number: true, name: true } },
				assignees: {
					where: { deletedAt: null },
					include: assigneeInclude,
				},
				comments: {
					where: {
						deletedAt: null,
						isDraft: false,
						senderRole: "COMMITTEE",
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
			const latestCommitteeActivityAt = getLatestCommitteeActivityAt(inq);
			const lastReadAt = inq.commentReadStatuses[0]?.lastReadAt ?? null;

			return {
				id: inq.id,
				title: inq.title,
				status: inq.status,
				creatorRole: inq.creatorRole,
				createdAt: inq.createdAt,
				sentAt: inq.sentAt,
				updatedAt: inq.updatedAt,
				isDraft: inq.isDraft,
				hasUnreadComments: latestCommitteeActivityAt
					? !lastReadAt ||
						latestCommitteeActivityAt.getTime() > lastReadAt.getTime()
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
			where: {
				id: inquiryId,
				projectId: project.id,
				deletedAt: null,
				isDraft: false,
			},
			include: {
				createdBy: { select: userSelect },
				project: {
					select: {
						id: true,
						number: true,
						name: true,
						organizationName: true,
					},
				},
				relatedForm: { select: { id: true, title: true } },
				assignees: {
					where: { deletedAt: null },
					include: assigneeInclude,
				},
				comments: {
					where: { deletedAt: null, isDraft: false },
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

		const allUserIds = [
			inquiry.createdBy.id,
			...inquiry.assignees.map(a => a.user.id),
			...inquiry.comments.map(cm => cm.createdBy.id),
			...inquiry.activities.map(act => act.actor.id),
			...inquiry.activities.flatMap(act => (act.target ? [act.target.id] : [])),
		];
		const affiliations = await getUserAffiliations(allUserIds);

		const sortedComments = inquiry.comments
			.map(cm => ({
				id: cm.id,
				body: cm.body,
				senderRole: cm.senderRole,
				createdAt: cm.createdAt,
				sentAt: cm.sentAt,
				createdBy: withAffiliation(cm.createdBy, affiliations),
				attachments: cm.attachments.map(formatAttachment),
			}))
			.sort(
				(a, b) => getCommentSentAt(a).getTime() - getCommentSentAt(b).getTime()
			);

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
			sentAt: inquiry.sentAt,
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
		const { body: commentBody, fileIds } =
			addInquiryCommentRequestSchema.parse(body);

		// 企画側担当者チェック
		await requireProjectAssignee(inquiryId, user.id);

		// ステータスチェック
		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, projectId: project.id, deletedAt: null },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}
		if (inquiry.isDraft) {
			throw Errors.invalidRequest("下書き状態のお問い合わせには返信できません");
		}
		if (inquiry.status === "RESOLVED") {
			throw Errors.invalidRequest("解決済みのお問い合わせには返信できません");
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
					senderRole: "PROJECT",
					sentAt: new Date(),
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

		void notifyInquiryCommentAdded({
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
			where: { id: inquiryId, projectId: project.id, deletedAt: null },
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
		const existing = await prisma.inquiryAssignee.findFirst({
			where: { inquiryId, userId, deletedAt: null },
		});
		if (existing) {
			throw Errors.alreadyExists("既に担当者です");
		}

		const inquiry = await prisma.inquiry.findFirst({
			where: { id: inquiryId, projectId: project.id, deletedAt: null },
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
			where: { id: inquiryId, projectId: project.id, deletedAt: null },
		});
		if (!inquiry) {
			throw Errors.notFound("お問い合わせが見つかりません");
		}

		const assignee = await prisma.inquiryAssignee.findFirst({
			where: { id: assigneeId, inquiryId, deletedAt: null },
		});
		if (!assignee) {
			throw Errors.notFound("担当者が見つかりません");
		}
		if (assignee.side !== "PROJECT") {
			throw Errors.forbidden("企画側の担当者のみ削除できます");
		}
		if (assignee.isCreator) {
			throw Errors.invalidRequest("作成者は担当者から削除できません");
		}

		await prisma.$transaction([
			prisma.inquiryAssignee.update({
				where: { id: assigneeId },
				data: { deletedAt: new Date() },
			}),
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
