import {
	createProjectRequestSchema,
	joinProjectRequestSchema,
	type ProjectMemberRole,
	updateProjectDetailRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const projectRoute = new Hono<AuthEnv>();

// 招待コード生成
const generateInviteCode = () =>
	Math.random().toString(36).substring(2, 8).toUpperCase();

// ─────────────────────────────────────────
// POST /project/create
// 企画を作成
// ─────────────────────────────────────────
projectRoute.post("/create", requireAuth, async c => {
	const body = await c.req.json().catch(() => ({}));
	const data = createProjectRequestSchema.parse(body);
	const userId = c.get("user").id;

	// ── 他の企画で責任者・副責任者をやっていないか確認 ──
	const hasOtherPrivilegedProject = await prisma.project.findFirst({
		where: {
			deletedAt: null,
			OR: [{ ownerId: userId }, { subOwnerId: userId }],
		},
	});

	if (hasOtherPrivilegedProject) {
		throw Errors.invalidRequest(
			"このユーザーはすでに他の企画で責任者または副責任者です"
		);
	}

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
// GET /project/list
// 自分が参加している企画一覧
// ─────────────────────────────────────────
projectRoute.get("/list", requireAuth, async c => {
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
// POST /project/join
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

// ─────────────────────────────────────────
// GET /project/:projectId/detail
// 企画の詳細を取得（招待コード含む）
// ─────────────────────────────────────────
projectRoute.get(
	"/:projectId/detail",
	requireAuth,
	requireProjectMember,
	async c => {
		const project = c.get("project");
		return c.json({ project });
	}
);

// ─────────────────────────────────────────
// PATCH /project/:projectId/detail
// 企画の設定変更（名前・団体名等）
// ─────────────────────────────────────────
projectRoute.patch(
	"/:projectId/detail",
	requireAuth,
	requireProjectMember,
	async c => {
		const role = c.get("projectRole");
		if (role !== "OWNER") {
			throw Errors.forbidden("企画の設定を変更できるのは責任者のみです");
		}

		const body = await c.req.json().catch(() => ({}));
		const data = updateProjectDetailRequestSchema.parse(body);
		const project = c.get("project");

		const updated = await prisma.project.update({
			where: { id: project.id },
			data,
		});

		return c.json({ project: updated });
	}
);

// ─────────────────────────────────────────
// POST /project/:projectId/invite-code/regenerate
// 招待コードを再生成
// ─────────────────────────────────────────
projectRoute.post(
	"/:projectId/invite-code/regenerate",
	requireAuth,
	requireProjectMember,
	async c => {
		const role = c.get("projectRole");
		if (role !== "OWNER") {
			throw Errors.forbidden("招待コードを再生成できるのは責任者のみです");
		}

		const project = c.get("project");

		let inviteCode = generateInviteCode();
		while (await prisma.project.findUnique({ where: { inviteCode } })) {
			inviteCode = generateInviteCode();
		}

		await prisma.project.update({
			where: { id: project.id },
			data: { inviteCode },
		});

		return c.json({ inviteCode });
	}
);

// ─────────────────────────────────────────
// GET /project/:projectId/members
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
			email: m.user.email,
			role,
			joinedAt: m.joinedAt,
		};
	});

	return c.json({ members: result });
});

// ─────────────────────────────────────────
// POST /project/:projectId/members/:userId/remove
// メンバーを削除
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// POST /project/:projectId/members/:userId/promote
// メンバーを副責任者に任命
// ─────────────────────────────────────────
projectRoute.post(
	"/:projectId/members/:userId/promote",
	requireAuth,
	async c => {
		const { projectId, userId } = c.req.param();
		const requesterId = c.get("user").id;

		// project 存在確認
		const project = await prisma.project.findFirst({
			where: {
				id: projectId,
				deletedAt: null,
			},
		});
		if (!project) {
			throw Errors.notFound("企画が見つかりません");
		}

		// 権限チェック（責任者のみ）
		if (project.ownerId !== requesterId) {
			throw Errors.forbidden("副責任者を任命できるのは責任者のみです");
		}

		// 任命対象がメンバーか
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

		// すでに副責任者がいる場合はエラー
		if (project.subOwnerId) {
			throw Errors.invalidRequest("すでに副責任者が任命されています");
		}

		// 責任者は指定不可
		if (userId === project.ownerId) {
			throw Errors.invalidRequest("責任者を副責任者には指定できません");
		}

		// 他企画で責任者、副責任者をやっていないかチェック
		const hasOtherPrivilegedProject = await prisma.project.findFirst({
			where: {
				deletedAt: null,
				id: {
					not: projectId,
				},
				OR: [{ ownerId: userId }, { subOwnerId: userId }],
			},
		});

		if (hasOtherPrivilegedProject) {
			throw Errors.invalidRequest(
				"このユーザーはすでに他の企画で責任者または副責任者です"
			);
		}

		await prisma.project.update({
			where: { id: projectId },
			data: {
				subOwnerId: userId,
			},
		});

		return c.json({
			success: true,
			subOwnerId: userId,
		});
	}
);

export { projectRoute };
