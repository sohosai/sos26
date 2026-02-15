import { createProjectRequestSchema } from "@sos26/shared";
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

export { projectRoute };
