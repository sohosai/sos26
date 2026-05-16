import type { Prisma } from "@prisma/client";
import {
	type CommitteeProjectAction,
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

const PER_SOURCE_LIMIT = 20;

async function fetchFormDeliveryActions(
	projectId: string
): Promise<CommitteeProjectAction[]> {
	const rows = await prisma.formDelivery.findMany({
		where: {
			projectId,
			formAuthorization: { form: { deletedAt: null } },
		},
		select: {
			id: true,
			createdAt: true,
			formAuthorization: {
				select: {
					form: { select: { id: true, title: true } },
					requestedBy: { select: { name: true } },
				},
			},
		},
		orderBy: { createdAt: "desc" },
		take: PER_SOURCE_LIMIT,
	});
	return rows.map(d => ({
		type: "FORM_DELIVERED",
		id: d.id,
		title: d.formAuthorization.form.title,
		sentAt: d.createdAt,
		actorName: d.formAuthorization.requestedBy.name,
		formId: d.formAuthorization.form.id,
	}));
}

// 初回提出 (PROJECT_SUBMIT) — フォームごとに最も古いレコードのみ採用
async function fetchFormSubmitActions(
	projectId: string
): Promise<CommitteeProjectAction[]> {
	const rows = await prisma.formItemEditHistory.findMany({
		where: {
			projectId,
			trigger: "PROJECT_SUBMIT",
			formItem: { form: { deletedAt: null } },
		},
		select: {
			id: true,
			createdAt: true,
			actor: { select: { name: true } },
			formItem: { select: { form: { select: { id: true, title: true } } } },
		},
		orderBy: { createdAt: "asc" },
		take: 200,
	});

	const seen = new Set<string>();
	const out: CommitteeProjectAction[] = [];
	for (const h of rows) {
		const formId = h.formItem.form.id;
		if (seen.has(formId)) continue;
		seen.add(formId);
		out.push({
			type: "FORM_ANSWERED",
			id: h.id,
			title: h.formItem.form.title,
			sentAt: h.createdAt,
			actorName: h.actor.name,
			formId,
		});
		if (out.length >= PER_SOURCE_LIMIT) break;
	}
	return out;
}

// 再提出 (PROJECT_RESUBMIT) — 同一フォーム×同一提出時刻でデデュープ
async function fetchFormResubmitActions(
	projectId: string
): Promise<CommitteeProjectAction[]> {
	const rows = await prisma.formItemEditHistory.findMany({
		where: {
			projectId,
			trigger: "PROJECT_RESUBMIT",
			formItem: { form: { deletedAt: null } },
		},
		select: {
			id: true,
			createdAt: true,
			actor: { select: { name: true } },
			formItem: { select: { form: { select: { id: true, title: true } } } },
		},
		orderBy: { createdAt: "desc" },
		take: 200,
	});

	const seen = new Set<string>();
	const out: CommitteeProjectAction[] = [];
	for (const h of rows) {
		const formId = h.formItem.form.id;
		const key = `${formId}:${h.createdAt.getTime()}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			type: "FORM_RESUBMITTED",
			id: h.id,
			title: h.formItem.form.title,
			sentAt: h.createdAt,
			actorName: h.actor.name,
			formId,
		});
		if (out.length >= PER_SOURCE_LIMIT) break;
	}
	return out;
}

async function fetchNoticeDeliveryActions(
	projectId: string
): Promise<CommitteeProjectAction[]> {
	const rows = await prisma.noticeDelivery.findMany({
		where: {
			projectId,
			noticeAuthorization: { notice: { deletedAt: null } },
		},
		select: {
			id: true,
			createdAt: true,
			noticeAuthorization: {
				select: {
					notice: { select: { id: true, title: true } },
					requestedBy: { select: { name: true } },
				},
			},
		},
		orderBy: { createdAt: "desc" },
		take: PER_SOURCE_LIMIT,
	});
	return rows.map(d => ({
		type: "NOTICE_DELIVERED",
		id: d.id,
		title: d.noticeAuthorization.notice.title,
		sentAt: d.createdAt,
		actorName: d.noticeAuthorization.requestedBy.name,
		noticeId: d.noticeAuthorization.notice.id,
	}));
}

async function fetchOwnerNoticeReadActions(
	projectId: string,
	ownerId: string
): Promise<CommitteeProjectAction[]> {
	const rows = await prisma.noticeReadStatus.findMany({
		where: {
			userId: ownerId,
			noticeDelivery: {
				projectId,
				noticeAuthorization: { notice: { deletedAt: null } },
			},
		},
		select: {
			id: true,
			createdAt: true,
			user: { select: { name: true } },
			noticeDelivery: {
				select: {
					noticeAuthorization: {
						select: { notice: { select: { id: true, title: true } } },
					},
				},
			},
		},
		orderBy: { createdAt: "desc" },
		take: PER_SOURCE_LIMIT,
	});
	return rows.map(r => ({
		type: "NOTICE_READ_BY_OWNER",
		id: r.id,
		title: r.noticeDelivery.noticeAuthorization.notice.title,
		sentAt: r.createdAt,
		actorName: r.user.name,
		noticeId: r.noticeDelivery.noticeAuthorization.notice.id,
	}));
}

async function fetchInquiryCreationActions(
	projectId: string
): Promise<CommitteeProjectAction[]> {
	const rows = await prisma.inquiry.findMany({
		where: { projectId, deletedAt: null, isDraft: false },
		select: {
			id: true,
			title: true,
			createdAt: true,
			sentAt: true,
			creatorRole: true,
			createdBy: { select: { name: true } },
		},
		orderBy: [
			{ sentAt: { sort: "desc", nulls: "last" } },
			{ createdAt: "desc" },
		],
		take: PER_SOURCE_LIMIT * 2,
	});
	return rows.map(i => ({
		type:
			i.creatorRole === "PROJECT"
				? "INQUIRY_CREATED_BY_PROJECT"
				: "INQUIRY_CREATED_BY_COMMITTEE",
		id: i.id,
		title: i.title,
		sentAt: i.sentAt ?? i.createdAt,
		actorName: i.createdBy.name,
		inquiryId: i.id,
	}));
}

async function fetchInquiryStatusActions(
	projectId: string
): Promise<CommitteeProjectAction[]> {
	const rows = await prisma.inquiryActivity.findMany({
		where: {
			type: { in: ["STATUS_RESOLVED", "STATUS_REOPENED"] },
			deletedAt: null,
			inquiry: { projectId, deletedAt: null },
		},
		select: {
			id: true,
			createdAt: true,
			type: true,
			inquiryId: true,
			actor: { select: { name: true } },
			inquiry: { select: { title: true } },
		},
		orderBy: { createdAt: "desc" },
		take: PER_SOURCE_LIMIT,
	});
	return rows.map(a => ({
		type:
			a.type === "STATUS_RESOLVED"
				? "INQUIRY_STATUS_RESOLVED"
				: "INQUIRY_STATUS_REOPENED",
		id: a.id,
		title: a.inquiry.title,
		sentAt: a.createdAt,
		actorName: a.actor.name,
		inquiryId: a.inquiryId,
	}));
}

async function fetchRegistrationFormSubmittedActions(
	projectId: string
): Promise<CommitteeProjectAction[]> {
	const rows = await prisma.projectRegistrationFormResponse.findMany({
		where: { projectId, deletedAt: null },
		select: { id: true, submittedAt: true },
		orderBy: { submittedAt: "desc" },
		take: PER_SOURCE_LIMIT,
	});
	return rows.map(r => ({
		type: "PROJECT_REGISTRATION_FORM_SUBMITTED",
		id: r.id,
		sentAt: r.submittedAt,
	}));
}

function buildDeletionStatusActions(project: {
	id: string;
	updatedAt: Date;
	deletionStatus: "LOTTERY_LOSS" | "DELETED" | "PROJECT_WITHDRAWN" | null;
}): CommitteeProjectAction[] {
	if (project.deletionStatus === null) return [];
	return [
		{
			type: "PROJECT_DELETION_STATUS_CHANGED",
			id: `project-deletion-status:${project.id}`,
			sentAt: project.updatedAt,
			deletionStatus: project.deletionStatus,
		},
	];
}

async function fetchProjectActions(project: {
	id: string;
	ownerId: string;
	updatedAt: Date;
	deletionStatus: "LOTTERY_LOSS" | "DELETED" | "PROJECT_WITHDRAWN" | null;
}): Promise<CommitteeProjectAction[]> {
	const groups = await Promise.all([
		fetchFormDeliveryActions(project.id),
		fetchFormSubmitActions(project.id),
		fetchFormResubmitActions(project.id),
		fetchNoticeDeliveryActions(project.id),
		fetchOwnerNoticeReadActions(project.id, project.ownerId),
		fetchInquiryCreationActions(project.id),
		fetchInquiryStatusActions(project.id),
		fetchRegistrationFormSubmittedActions(project.id),
	]);

	const actions = [...groups.flat(), ...buildDeletionStatusActions(project)];
	actions.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
	return actions;
}

function maskContact<
	T extends {
		id: string;
		name: string;
		email: string;
		telephoneNumber: string;
		avatarFileId: string | null;
	},
>(
	person: T | null,
	canViewContacts: boolean
): {
	id: string;
	name: string;
	email: string | null;
	telephoneNumber: string | null;
	avatarFileId: string | null;
} | null {
	if (!person) return null;
	return {
		id: person.id,
		name: person.name,
		email: canViewContacts ? person.email : null,
		telephoneNumber: canViewContacts ? person.telephoneNumber : null,
		avatarFileId: person.avatarFileId,
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
					avatarFileId: true,
				},
			},
			subOwner: {
				select: {
					id: true,
					name: true,
					email: true,
					telephoneNumber: true,
					avatarFileId: true,
				},
			},
			_count: {
				select: { projectMembers: { where: { deletedAt: null } } },
			},
		},
	});

	if (!project) {
		return { project: null, actions: [] as CommitteeProjectAction[] };
	}

	const actions = await fetchProjectActions({
		id: project.id,
		ownerId: project.ownerId,
		updatedAt: project.updatedAt,
		deletionStatus: project.deletionStatus,
	});

	return { project, actions };
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
					avatarFileId: true,
				},
			},
			subOwner: {
				select: {
					id: true,
					name: true,
					email: true,
					telephoneNumber: true,
					avatarFileId: true,
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

		const { project, actions } =
			await fetchCommitteeProjectDetailData(projectId);

		if (!project) {
			throw Errors.notFound("企画が見つかりません");
		}

		const status = getProjectStatusFields(project);

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
			actions,
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
						avatarFileId: true,
					},
				},
				subOwner: {
					select: {
						id: true,
						name: true,
						email: true,
						telephoneNumber: true,
						avatarFileId: true,
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
				avatarFileId: m.user.avatarFileId,
			};
		});

		return c.json({ members: result });
	}
);

export { committeeProjectRoute };
