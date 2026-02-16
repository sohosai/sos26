import {
	createProjectRequestSchema,
	joinProjectRequestSchema,
	type ProjectMemberRole,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const projectRoute = new Hono<AuthEnv>();

// 招待コード生成
const generateInviteCode = () =>
	Math.random().toString(36).substring(2, 8).toUpperCase();

// ─────────────────────────────────────────
// POST /projects/subscribe
// 企画を作成
// ─────────────────────────────────────────
projectRoute.post("/subscribe", requireAuth, async c => {
	const body = await c.req.json().catch(() => ({}));
	const data = createProjectRequestSchema.parse(body);
	const userId = c.get("user").id;
	// 責任者の存在確認
	const owner = await prisma.user.findFirst({
		where: { id: userId, deletedAt: null },
	});
	if (!owner) {
		throw Errors.notFound("責任者ユーザーが見つかりません");
	}

	// 副責任者
	// if (data.subOwnerId) {
	// 	const subOwner = await prisma.user.findFirst({
	// 		where: { id: data.subOwnerId, deletedAt: null },
	// 	});
	// 	if (!subOwner) {
	// 		throw Errors.notFound("副責任者ユーザーが見つかりません");
	// 	}
	// }

	// 招待コード生成（衝突回避）
	let inviteCode = generateInviteCode();
	while (await prisma.project.findUnique({ where: { inviteCode } })) {
		inviteCode = generateInviteCode();
	}

	const project = await prisma.project.create({
		data: {
			...data,
			ownerId: userId,
			subOwnerId: null,
			inviteCode,
			projectMembers: {
				create: {
					userId: userId,
				},
			},
		},
	});

	return c.json({ project });
});

// ─────────────────────────────────────────
// GET /projects
// 自分が参加している企画一覧
// ─────────────────────────────────────────
projectRoute.get("/", requireAuth, async c => {
	const userId = c.get("user").id;

	const projects = await prisma.project.findMany({
		where: {
			deletedAt: null,
			projectMembers: {
				some: {
					userId,
					deletedAt: null,
				},
			},
		},
	});

	return c.json({ projects });
});

// ─────────────────────────────────────────
// GET /projects/:projectId/members
// 該当する企画のメンバー一覧
// ─────────────────────────────────────────
projectRoute.get("/:projectId/members", requireAuth, async c => {
	const projectId = c.req.param("projectId");
	const userId = c.get("user").id;

	// project の存在確認
	const project = await prisma.project.findFirst({
		where: {
			id: projectId,
			deletedAt: null,
		},
	});
	if (!project) {
		throw Errors.notFound("企画が見つかりません");
	}

	// 自分がこの project に参加しているか
	const isMember = await prisma.projectMember.findFirst({
		where: {
			projectId,
			userId,
			deletedAt: null,
		},
	});
	if (!isMember) {
		throw Errors.forbidden("この企画のメンバーではありません");
	}

	// メンバー一覧取得
	const members = await prisma.projectMember.findMany({
		where: {
			projectId,
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
			role,
			joinedAt: m.joinedAt,
		};
	});

	return c.json({ members: result });
});
export { projectRoute };

// ─────────────────────────────────────────
// POST /projects/join
// 招待コードで企画に参加
// ─────────────────────────────────────────
projectRoute.post("/join", requireAuth, async c => {
	const body = await c.req.json().catch(() => ({}));
	const { inviteCode } = joinProjectRequestSchema.parse(body);

	const userId = c.get("user").id;

	const project = await prisma.project.findFirst({
		where: {
			inviteCode,
			deletedAt: null,
		},
	});

	if (!project) {
		throw Errors.notFound("招待コードが無効です");
	}

	// すでにメンバーか確認
	const alreadyMember = await prisma.projectMember.findFirst({
		where: {
			projectId: project.id,
			userId,
			deletedAt: null,
		},
	});

	if (alreadyMember) {
		throw Errors.alreadyExists("すでにこの企画に参加しています");
	}

	await prisma.projectMember.create({
		data: {
			projectId: project.id,
			userId,
		},
	});

	return c.json({ project });
});

projectRoute.post(
	"/:projectId/members/:userId/remove",
	requireAuth,
	async c => {
		const { projectId, userId } = c.req.param();
		const requesterId = c.get("user").id;

		// project の存在確認
		const project = await prisma.project.findFirst({
			where: {
				id: projectId,
				deletedAt: null,
			},
		});

		if (!project) {
			throw Errors.notFound("企画が見つかりません");
		}

		// 権限チェック（責任者 or 副責任者）
		const isPrivileged =
			project.ownerId === requesterId || project.subOwnerId === requesterId;

		if (!isPrivileged) {
			throw Errors.forbidden("この操作を行う権限がありません");
		}

		// 削除対象がメンバーか確認
		const member = await prisma.projectMember.findFirst({
			where: {
				projectId,
				userId,
				deletedAt: null,
			},
		});

		if (!member) {
			throw Errors.notFound("対象ユーザーは企画メンバーではありません");
		}

		if (userId === project.ownerId || userId === project.subOwnerId) {
			throw Errors.invalidRequest("責任者・副責任者は削除できません");
		}

		await prisma.projectMember.update({
			where: { id: member.id },
			data: { deletedAt: new Date() },
		});

		return c.json({ success: true });
	}
);
