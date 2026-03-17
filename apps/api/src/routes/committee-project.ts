import type { Prisma } from "@prisma/client";
import {
	listCommitteeProjectsQuerySchema,
	type ProjectMemberRole,
	updateCommitteeProjectBaseInfoRequestSchema,
	updateCommitteeProjectDeletionStatusRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
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
	isActive: boolean;
	deletionStatus: "LOTTERY_LOSS" | "DELETED" | null;
};

type ProjectActionItem = {
	id: string;
	title: string;
	sentAt: Date;
};

function getProjectStatusFields(project: object): ProjectStatusFields {
	const candidate = project as Partial<ProjectStatusFields>;

	return {
		isActive: candidate.isActive ?? true,
		deletionStatus: candidate.deletionStatus ?? null,
	};
}

function getProjectDeletionStatusLabel(
	status: "LOTTERY_LOSS" | "DELETED" | null
): string {
	if (status === "LOTTERY_LOSS") return "抽選漏れ";
	if (status === "DELETED") return "削除";
	return "";
}

function shouldNotifyDeletionStatusUpdate(
	deletionStatus: "LOTTERY_LOSS" | "DELETED" | null,
	beforeStatus: ProjectStatusFields
): deletionStatus is "LOTTERY_LOSS" | "DELETED" {
	return (
		deletionStatus !== null &&
		(beforeStatus.deletionStatus !== deletionStatus || beforeStatus.isActive)
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

async function fetchCommitteeProjectDetailData(projectId: string) {
	const [project, formDeliveries, noticeDeliveries, inquiries] =
		await Promise.all([
			prisma.project.findFirst({
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
			}),
			prisma.formDelivery.findMany({
				where: { projectId },
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
				where: { projectId },
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
				where: { projectId, deletedAt: null, isDraft: false },
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
	projectName: string;
	status: "LOTTERY_LOSS" | "DELETED";
	updatedByName: string;
}): Promise<void> {
	try {
		const statusLabel = getProjectDeletionStatusLabel(input.status);
		const url = `${env.APP_URL}/project`;
		const body = `あなたの企画の状態が変更されました。

企画名: ${input.projectName}
状態: ${statusLabel}
更新者: ${input.updatedByName}

詳細は以下のURLからご確認ください。
${url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

		await sendEmail({
			to: input.ownerEmail,
			subject: `【雙峰祭オンラインシステム】企画状態が「${statusLabel}」に更新されました`,
			html: textToHtml(body),
			text: body,
		});

		await sendPushToUsers({
			userIds: [input.ownerUserId],
			payload: {
				title: "企画状態が更新されました",
				body: `${input.projectName}: ${statusLabel}`,
				icon: "/sos.svg",
				badge: "/sos.svg",
				lang: "ja-JP",
				tag: `project-status:${input.ownerUserId}:${input.status}`,
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
			? {
					id: project.owner.id,
					name: project.owner.name,
					email: permissions.canViewContacts ? project.owner.email : null,
					telephoneNumber: permissions.canViewContacts
						? project.owner.telephoneNumber
						: null,
				}
			: null;

		const subOwner = project.subOwner
			? {
					id: project.subOwner.id,
					name: project.subOwner.name,
					email: permissions.canViewContacts ? project.subOwner.email : null,
					telephoneNumber: permissions.canViewContacts
						? project.subOwner.telephoneNumber
						: null,
				}
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
	async c => {
		const projectId = c.req.param("projectId");
		const user = c.get("user");
		const permissions = await resolveProjectPermissions(user.id);

		if (!permissions.canDelete) {
			throw Errors.forbidden("企画削除権限がありません");
		}

		const body = await c.req.json().catch(() => ({}));
		const { deletionStatus } =
			updateCommitteeProjectDeletionStatusRequestSchema.parse(body);

		const projectBefore = await prisma.project.findFirst({
			where: { id: projectId, deletedAt: null },
			include: {
				owner: {
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

		const updateData: Prisma.ProjectUpdateInput = {
			isActive: deletionStatus === null,
			deletionStatus,
		};

		await prisma.project.update({
			where: { id: projectId },
			data: updateData,
		});

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

		const beforeStatus = getProjectStatusFields(projectBefore);
		const status = getProjectStatusFields(project);

		if (shouldNotifyDeletionStatusUpdate(deletionStatus, beforeStatus)) {
			await notifyProjectDeletionStatusUpdated({
				ownerUserId: projectBefore.owner.id,
				ownerEmail: projectBefore.owner.email,
				projectName: projectBefore.name,
				status: deletionStatus,
				updatedByName: user.name,
			});
		}

		const maskedOwner = project.owner
			? {
					...project.owner,
					email: permissions.canViewContacts ? project.owner.email : null,
					telephoneNumber: permissions.canViewContacts
						? project.owner.telephoneNumber
						: null,
				}
			: null;

		const maskedSubOwner = project.subOwner
			? {
					...project.subOwner,
					email: permissions.canViewContacts ? project.subOwner.email : null,
					telephoneNumber: permissions.canViewContacts
						? project.subOwner.telephoneNumber
						: null,
				}
			: null;

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
				owner: maskedOwner,
				subOwner: maskedSubOwner,
			},
		});
	}
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
