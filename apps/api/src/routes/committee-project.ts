import type { Prisma } from "@prisma/client";
import {
	listCommitteeProjectsQuerySchema,
	type ProjectMemberRole,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeProjectRoute = new Hono<AuthEnv>();

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
		id: p.id,
		number: p.number,
		name: p.name,
		namePhonetic: p.namePhonetic,
		organizationName: p.organizationName,
		organizationNamePhonetic: p.organizationNamePhonetic,
		type: p.type,
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

		const project = await prisma.project.findFirst({
			where: { id: projectId, deletedAt: null },
			include: {
				owner: { select: { id: true, name: true, email: true } },
				subOwner: { select: { id: true, name: true, email: true } },
				_count: {
					select: { projectMembers: { where: { deletedAt: null } } },
				},
			},
		});

		if (!project) {
			throw Errors.notFound("企画が見つかりません");
		}

		const result = {
			id: project.id,
			number: project.number,
			name: project.name,
			namePhonetic: project.namePhonetic,
			organizationName: project.organizationName,
			organizationNamePhonetic: project.organizationNamePhonetic,
			type: project.type,
			ownerId: project.ownerId,
			subOwnerId: project.subOwnerId,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt,
			memberCount: project._count.projectMembers,
			owner: project.owner,
			subOwner: project.subOwner,
		};

		return c.json({ project: result });
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
