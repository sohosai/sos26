import type { Prisma } from "@prisma/client";
import {
	listCommitteeProjectsQuerySchema,
	type ProjectMemberRole,
	type UpdateCommitteeProjectBaseInfoRequest,
	updateCommitteeProjectBaseInfoRequestSchema,
	updateCommitteeProjectDeletionStatusRequestSchema,
} from "@sos26/shared";
import { type Context, Hono } from "hono";
import { sendEmail } from "../lib/emails/providers/sendgridClient";
import { textToHtml } from "../lib/emails/templates/textToHtml";
import { env } from "../lib/env";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { sendPushToUsers } from "../lib/push";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeProjectRoute = new Hono<AuthEnv>();

type ProjectStatusFields = {
	deletionStatus: "LOTTERY_LOSS" | "DELETED" | "PROJECT_WITHDRAWN" | null;
};

type ProjectActionItem = {
	id: string;
	title: string;
	sentAt: Date;
};

function getProjectStatusFields(project: object): ProjectStatusFields {
	const candidate = project as Partial<ProjectStatusFields>;
	const deletionStatus = candidate.deletionStatus ?? null;

	return {
		deletionStatus,
	};
}

function getProjectDeletionStatusLabel(
	status: "LOTTERY_LOSS" | "DELETED" | "PROJECT_WITHDRAWN" | null
): string {
	if (status === "LOTTERY_LOSS") return "落選";
	if (status === "DELETED") return "企画中止";
	if (status === "PROJECT_WITHDRAWN") return "企画辞退";
	return "";
}

function shouldNotifyDeletionStatusUpdate(
	deletionStatus: "LOTTERY_LOSS" | "DELETED" | "PROJECT_WITHDRAWN" | null,
	beforeStatus: ProjectStatusFields
): deletionStatus is "LOTTERY_LOSS" | "DELETED" | "PROJECT_WITHDRAWN" {
	return (
		deletionStatus !== null && beforeStatus.deletionStatus !== deletionStatus
	);
}

function mapFormActions(
	formDeliveries: Array<{
		id: string;
		createdAt: Date;
		formAuthorization: { form: { title: string; deletedAt: Date | null } };
	}>
): ProjectActionItem[] {
	const actions: ProjectActionItem[] = [];
	for (const delivery of formDeliveries) {
		if (delivery.formAuthorization.form.deletedAt !== null) continue;
		actions.push({
			id: delivery.id,
			title: delivery.formAuthorization.form.title,
			sentAt: delivery.createdAt,
		});
		if (actions.length >= 20) break;
	}
	return actions;
}

function mapNoticeActions(
	noticeDeliveries: Array<{
		id: string;
		createdAt: Date;
		noticeAuthorization: { notice: { title: string; deletedAt: Date | null } };
	}>
): ProjectActionItem[] {
	const actions: ProjectActionItem[] = [];
	for (const delivery of noticeDeliveries) {
		if (delivery.noticeAuthorization.notice.deletedAt !== null) continue;
		actions.push({
			id: delivery.id,
			title: delivery.noticeAuthorization.notice.title,
			sentAt: delivery.createdAt,
		});
		if (actions.length >= 20) break;
	}
	return actions;
}

function maskContact<
	T extends {
		id: string;
		name: string;
		email: string;
		telephoneNumber: string;
	},
>(
	person: T | null,
	canViewContacts: boolean
): {
	id: string;
	name: string;
	email: string | null;
	telephoneNumber: string | null;
} | null {
	if (!person) return null;
	return {
		id: person.id,
		name: person.name,
		email: canViewContacts ? person.email : null,
		telephoneNumber: canViewContacts ? person.telephoneNumber : null,
	};
}

async function fetchCommitteeProjectDetailData(projectParam: string) {
	const isNumericProjectNumber = /^\d{1,3}$/.test(projectParam);

	const projectWhere: Prisma.ProjectWhereInput = {
		deletedAt: null,
		...(isNumericProjectNumber
			? { number: Number.parseInt(projectParam, 10) }
			: { id: projectParam }),
	};

	const project = await prisma.project.findFirst({
		where: projectWhere,
		include: {
			owner: {
				select: {
					id: true,
					name: true,
					email: true,
					telephoneNumber: true,
				},
			},
			subOwner: {
				select: {
					id: true,
					name: true,
					email: true,
					telephoneNumber: true,
				},
			},
			_count: {
				select: { projectMembers: { where: { deletedAt: null } } },
			},
		},
	});

	if (!project) {
		return {
			project: null,
			formDeliveries: [],
			noticeDeliveries: [],
			inquiries: [],
		};
	}

	const [formDeliveries, noticeDeliveries, inquiries] = await Promise.all([
		prisma.formDelivery.findMany({
			where: {
				projectId: project.id,
				formAuthorization: {
					form: {
						deletedAt: null,
					},
				},
			},
			select: {
				id: true,
				createdAt: true,
				formAuthorization: {
					select: {
						form: {
							select: { title: true, deletedAt: true },
						},
					},
				},
			},
			orderBy: { createdAt: "desc" },
			take: 20,
		}),
		prisma.noticeDelivery.findMany({
			where: {
				projectId: project.id,
				noticeAuthorization: {
					notice: {
						deletedAt: null,
					},
				},
			},
			select: {
				id: true,
				createdAt: true,
				noticeAuthorization: {
					select: {
						notice: {
							select: { title: true, deletedAt: true },
						},
					},
				},
			},
			orderBy: { createdAt: "desc" },
			take: 20,
		}),
		prisma.inquiry.findMany({
			where: { projectId: project.id, deletedAt: null, isDraft: false },
			select: {
				id: true,
				title: true,
				createdAt: true,
			},
			orderBy: { createdAt: "desc" },
			take: 20,
		}),
	]);

	return { project, formDeliveries, noticeDeliveries, inquiries };
}

async function resolveProjectPermissions(userId: string): Promise<{
	canEdit: boolean;
	canDelete: boolean;
	canViewContacts: boolean;
}> {
	const member = await prisma.committeeMember.findFirst({
		where: { userId, deletedAt: null },
		include: { permissions: true },
	});

	if (!member) {
		return { canEdit: false, canDelete: false, canViewContacts: false };
	}

	const has = (permission: string) =>
		(member.permissions ?? []).some(p => p.permission === permission);

	return {
		canEdit: has("PROJECT_EDIT"),
		canDelete: has("PROJECT_DELETE"),
		canViewContacts: has("PROJECT_VIEW"),
	};
}

async function notifyProjectDeletionStatusUpdated(input: {
	ownerUserId: string;
	ownerEmail: string;
	subOwnerUserId: string | null;
	subOwnerEmail: string | null;
	projectName: string;
	status: "LOTTERY_LOSS" | "DELETED" | "PROJECT_WITHDRAWN";
	updatedByName: string;
}): Promise<void> {
	try {
		const statusLabel = getProjectDeletionStatusLabel(input.status);
		const url = `${env.APP_URL}/project`;
		const notifyEmails = [input.ownerEmail, input.subOwnerEmail].filter(
			(email): email is string => Boolean(email)
		);
		const notifyUserIds = [input.ownerUserId, input.subOwnerUserId].filter(
			(userId): userId is string => Boolean(userId)
		);
		const uniqueNotifyEmails = [...new Set(notifyEmails)];
		const uniqueNotifyUserIds = [...new Set(notifyUserIds)];
		const body = `あなたの企画の状態が変更されました。

企画名: ${input.projectName}
状態: ${statusLabel}
更新者: ${input.updatedByName}

詳細は以下のURLからご確認ください。
${url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

		await Promise.all(
			uniqueNotifyEmails.map(to =>
				sendEmail({
					to,
					subject: `【雙峰祭オンラインシステム】企画状態が「${statusLabel}」に更新されました`,
					html: textToHtml(body),
					text: body,
				})
			)
		);

		await sendPushToUsers({
			userIds: uniqueNotifyUserIds,
			payload: {
				title: "企画状態が更新されました",
				body: `${input.projectName}: ${statusLabel}`,
				icon: "/sos.svg",
				badge: "/sos.svg",
				lang: "ja-JP",
				tag: `project-status:${input.projectName}:${input.status}`,
				renotify: true,
				timestamp: Date.now(),
				data: { url, type: "PROJECT_DELETION_STATUS_UPDATED" },
			},
		});
	} catch (err) {
		console.error(
			"[Notification] notifyProjectDeletionStatusUpdated failed",
			err
		);
	}
}

async function maybeNotifyProjectDeletionStatusUpdated(input: {
	deletionStatus: "LOTTERY_LOSS" | "DELETED" | "PROJECT_WITHDRAWN" | null;
	beforeStatus: ProjectStatusFields;
	projectBefore: {
		name: string;
		owner: { id: string; email: string };
		subOwner: { id: string; email: string } | null;
	};
	updatedByName: string;
}): Promise<void> {
	if (
		!shouldNotifyDeletionStatusUpdate(input.deletionStatus, input.beforeStatus)
	) {
		return;
	}

	await notifyProjectDeletionStatusUpdated({
		ownerUserId: input.projectBefore.owner.id,
		ownerEmail: input.projectBefore.owner.email,
		subOwnerUserId: input.projectBefore.subOwner?.id ?? null,
		subOwnerEmail: input.projectBefore.subOwner?.email ?? null,
		projectName: input.projectBefore.name,
		status: input.deletionStatus,
		updatedByName: input.updatedByName,
	});
}

async function findProjectBeforeDeletionStatusUpdate(projectId: string) {
	const projectBefore = await prisma.project.findFirst({
		where: { id: projectId, deletedAt: null },
		include: {
			owner: {
				select: {
					id: true,
					email: true,
				},
			},
			subOwner: {
				select: {
					id: true,
					email: true,
				},
			},
		},
	});

	if (!projectBefore) {
		throw Errors.notFound("企画が見つかりません");
	}

	return projectBefore;
}

async function findProjectAfterDeletionStatusUpdate(projectId: string) {
	const project = await prisma.project.findFirst({
		where: { id: projectId, deletedAt: null },
		include: {
			owner: {
				select: {
					id: true,
					name: true,
					email: true,
					telephoneNumber: true,
				},
			},
			subOwner: {
				select: {
					id: true,
					name: true,
					email: true,
					telephoneNumber: true,
				},
			},
			_count: {
				select: { projectMembers: { where: { deletedAt: null } } },
			},
		},
	});

	if (!project) {
		throw Errors.notFound("企画が見つかりません");
	}

	return project;
}

function buildDeletionStatusProjectResponse(
	project: Awaited<ReturnType<typeof findProjectAfterDeletionStatusUpdate>>,
	status: ProjectStatusFields,
	permissions: { canViewContacts: boolean }
) {
	const owner = maskContact(project.owner, permissions.canViewContacts);
	const subOwner = maskContact(project.subOwner, permissions.canViewContacts);

	return {
		...status,
		id: project.id,
		number: project.number,
		name: project.name,
		namePhonetic: project.namePhonetic,
		organizationName: project.organizationName,
		organizationNamePhonetic: project.organizationNamePhonetic,
		type: project.type,
		location: project.location,
		ownerId: project.ownerId,
		subOwnerId: project.subOwnerId,
		createdAt: project.createdAt,
		updatedAt: project.updatedAt,
		memberCount: project._count.projectMembers,
		owner,
		subOwner,
	};
}

async function handleUpdateProjectDeletionStatus(c: Context<AuthEnv>) {
	const projectId = c.req.param("projectId");
	const user = c.get("user");
	const permissions = await resolveProjectPermissions(user.id);

	if (!permissions.canDelete) {
		throw Errors.forbidden("企画中止権限がありません");
	}

	const body = await c.req.json().catch(() => ({}));
	const { deletionStatus } =
		updateCommitteeProjectDeletionStatusRequestSchema.parse(body);

	const projectBefore = await findProjectBeforeDeletionStatusUpdate(projectId);

	await prisma.project.updateMany({
		where: { id: projectId, deletedAt: null },
		data: { deletionStatus } as Prisma.ProjectUpdateInput,
	});

	const project = await findProjectAfterDeletionStatusUpdate(projectId);
	const beforeStatus = getProjectStatusFields(projectBefore);
	const status = getProjectStatusFields(project);

	await maybeNotifyProjectDeletionStatusUpdated({
		deletionStatus,
		beforeStatus,
		projectBefore,
		updatedByName: user.name,
	});

	return c.json({
		project: buildDeletionStatusProjectResponse(project, status, permissions),
	});
}

// ─────────────────────────────────────────────────────────────
// GET /committee/projects
// 全企画一覧（フィルタ・検索・ページネーション）
// ─────────────────────────────────────────────────────────────
committeeProjectRoute.get("/", requireAuth, requireCommitteeMember, async c => {
	const query = listCommitteeProjectsQuerySchema.parse(c.req.query());
	const { type, search, page, limit } = query;

	const where: Prisma.ProjectWhereInput = { deletedAt: null };

	if (type) {
		where.type = type;
	}

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: "insensitive" } },
			{ organizationName: { contains: search, mode: "insensitive" } },
		];
	}

	const [projects, total] = await Promise.all([
		prisma.project.findMany({
			where,
			include: {
				owner: { select: { name: true } },
				_count: {
					select: { projectMembers: { where: { deletedAt: null } } },
				},
			},
			...(limit !== undefined && {
				skip: (page - 1) * limit,
				take: limit,
			}),
			orderBy: { createdAt: "desc" },
		}),
		prisma.project.count({ where }),
	]);

	const result = projects.map(p => ({
		...getProjectStatusFields(p),
		id: p.id,
		number: p.number,
		name: p.name,
		namePhonetic: p.namePhonetic,
		organizationName: p.organizationName,
		organizationNamePhonetic: p.organizationNamePhonetic,
		type: p.type,
		location: p.location,
		ownerId: p.ownerId,
		subOwnerId: p.subOwnerId,
		createdAt: p.createdAt,
		updatedAt: p.updatedAt,
		memberCount: p._count.projectMembers,
		ownerName: p.owner.name,
	}));

	return c.json({
		projects: result,
		total,
		...(limit !== undefined && { page, limit }),
	});
});

// ─────────────────────────────────────────────────────────────
// GET /committee/projects/:projectId
// 企画詳細（メンバー数・owner/subOwner情報含む）
// ─────────────────────────────────────────────────────────────
committeeProjectRoute.get(
	"/:projectId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const projectId = c.req.param("projectId");
		const user = c.get("user");
		const permissions = await resolveProjectPermissions(user.id);

		const { project, formDeliveries, noticeDeliveries, inquiries } =
			await fetchCommitteeProjectDetailData(projectId);

		if (!project) {
			throw Errors.notFound("企画が見つかりません");
		}

		const status = getProjectStatusFields(project);
		const formActions = mapFormActions(formDeliveries);
		const noticeActions = mapNoticeActions(noticeDeliveries);

		const result = {
			...status,
			id: project.id,
			number: project.number,
			name: project.name,
			namePhonetic: project.namePhonetic,
			organizationName: project.organizationName,
			organizationNamePhonetic: project.organizationNamePhonetic,
			type: project.type,
			location: project.location,
			ownerId: project.ownerId,
			subOwnerId: project.subOwnerId,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt,
			memberCount: project._count.projectMembers,
			owner: maskContact(project.owner, permissions.canViewContacts),
			subOwner: maskContact(project.subOwner, permissions.canViewContacts),
			actions: {
				forms: formActions,
				notices: noticeActions,
				inquiries: inquiries.map(i => ({
					id: i.id,
					title: i.title,
					sentAt: i.createdAt,
				})),
			},
			permissions,
		};

		return c.json({ project: result });
	}
);

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>複数の責任者バリデーションロジックが連続しているだけ
async function validateProjectOwnerUpdates(
	projectId: string,
	data: UpdateCommitteeProjectBaseInfoRequest
) {
	if (!data.ownerId && data.subOwnerId === undefined) {
		return;
	}

	const project = await prisma.project.findFirst({
		where: { id: projectId, deletedAt: null },
	});

	if (!project) {
		throw Errors.notFound("企画が見つかりません");
	}

	const ownerId = data.ownerId ?? project.ownerId;
	const subOwnerId =
		data.subOwnerId !== undefined ? data.subOwnerId : project.subOwnerId;

	// 同じユーザーが責任者と副責任者になってはいけない
	if (ownerId && subOwnerId && ownerId === subOwnerId) {
		throw Errors.invalidRequest(
			"企画責任者と副企画責任者は異なるメンバーを指定してください"
		);
	}

	// 新しい責任者がメンバーか確認
	if (data.ownerId && data.ownerId !== project.ownerId) {
		const newOwnerMember = await prisma.projectMember.findFirst({
			where: {
				projectId,
				userId: data.ownerId,
				deletedAt: null,
			},
		});

		if (!newOwnerMember) {
			throw Errors.notFound("新しい企画責任者は企画メンバーではありません");
		}

		// 新しい責任者が他の企画で既に責任者または副責任者になっていないか確認
		const existingOwnerRole = await prisma.project.findFirst({
			where: {
				deletedAt: null,
				id: { not: projectId },
				OR: [{ ownerId: data.ownerId }, { subOwnerId: data.ownerId }],
			},
		});

		if (existingOwnerRole) {
			throw Errors.invalidRequest(
				"このメンバーは既に別の企画の企画責任者として登録されています"
			);
		}
	}

	// 新しい副責任者がメンバーか確認（nullableなので設定されている場合のみ）
	if (
		data.subOwnerId !== undefined &&
		data.subOwnerId !== null &&
		data.subOwnerId !== project.subOwnerId
	) {
		const newSubOwnerMember = await prisma.projectMember.findFirst({
			where: {
				projectId,
				userId: data.subOwnerId,
				deletedAt: null,
			},
		});

		if (!newSubOwnerMember) {
			throw Errors.notFound("新しい副企画責任者は企画メンバーではありません");
		}

		// 新しい副責任者が他の企画で既に責任者または副責任者になっていないか確認
		const existingSubOwnerRole = await prisma.project.findFirst({
			where: {
				deletedAt: null,
				id: { not: projectId },
				OR: [{ ownerId: data.subOwnerId }, { subOwnerId: data.subOwnerId }],
			},
		});

		if (existingSubOwnerRole) {
			throw Errors.invalidRequest(
				"このメンバーは既に別の企画の企画責任者または、副企画責任者として登録されています"
			);
		}
	}
}

committeeProjectRoute.patch(
	"/:projectId/base-info",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const projectId = c.req.param("projectId");
		const user = c.get("user");
		const permissions = await resolveProjectPermissions(user.id);

		if (!permissions.canEdit) {
			throw Errors.forbidden("企画編集権限がありません");
		}

		const body = await c.req.json().catch(() => ({}));
		const data = updateCommitteeProjectBaseInfoRequestSchema.parse(body);

		// 責任者情報のバリデーション
		await validateProjectOwnerUpdates(projectId, data);

		const updated = await prisma.project.updateMany({
			where: { id: projectId, deletedAt: null },
			data,
		});

		if (updated.count === 0) {
			throw Errors.notFound("企画が見つかりません");
		}

		const project = await prisma.project.findFirst({
			where: { id: projectId, deletedAt: null },
			include: {
				owner: {
					select: {
						id: true,
						name: true,
						email: true,
						telephoneNumber: true,
					},
				},
				subOwner: {
					select: {
						id: true,
						name: true,
						email: true,
						telephoneNumber: true,
					},
				},
				_count: {
					select: { projectMembers: { where: { deletedAt: null } } },
				},
			},
		});

		if (!project) {
			throw Errors.notFound("企画が見つかりません");
		}

		const owner = project.owner
			? maskContact(project.owner, permissions.canViewContacts)
			: null;

		const subOwner = project.subOwner
			? maskContact(project.subOwner, permissions.canViewContacts)
			: null;

		const status = getProjectStatusFields(project);

		return c.json({
			project: {
				...status,
				id: project.id,
				number: project.number,
				name: project.name,
				namePhonetic: project.namePhonetic,
				organizationName: project.organizationName,
				organizationNamePhonetic: project.organizationNamePhonetic,
				type: project.type,
				location: project.location,
				ownerId: project.ownerId,
				subOwnerId: project.subOwnerId,
				createdAt: project.createdAt,
				updatedAt: project.updatedAt,
				memberCount: project._count.projectMembers,
				owner,
				subOwner,
			},
		});
	}
);

committeeProjectRoute.patch(
	"/:projectId/deletion-status",
	requireAuth,
	requireCommitteeMember,
	async c => handleUpdateProjectDeletionStatus(c)
);

// ─────────────────────────────────────────────────────────────
// GET /committee/projects/:projectId/members
// 企画メンバー一覧
// ─────────────────────────────────────────────────────────────
committeeProjectRoute.get(
	"/:projectId/members",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const projectId = c.req.param("projectId");

		const project = await prisma.project.findFirst({
			where: { id: projectId, deletedAt: null },
		});

		if (!project) {
			throw Errors.notFound("企画が見つかりません");
		}

		const members = await prisma.projectMember.findMany({
			where: {
				projectId: project.id,
				deletedAt: null,
			},
			include: {
				user: true,
			},
			orderBy: {
				joinedAt: "asc",
			},
		});

		const result = members.map(m => {
			let role: ProjectMemberRole = "MEMBER";

			if (m.userId === project.ownerId) {
				role = "OWNER";
			} else if (m.userId === project.subOwnerId) {
				role = "SUB_OWNER";
			}

			return {
				id: m.id,
				userId: m.userId,
				name: m.user.name,
				email: m.user.email,
				role,
				joinedAt: m.joinedAt,
			};
		});

		return c.json({ members: result });
	}
);

export { committeeProjectRoute };
