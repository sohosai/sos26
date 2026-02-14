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
// POST /projects
// 企画を作成
// ─────────────────────────────────────────
projectRoute.post("/", requireAuth, async c => {
	const body = await c.req.json().catch(() => ({}));
	const data = createProjectRequestSchema.parse(body);

	// 責任者の存在確認
	const owner = await prisma.user.findFirst({
		where: { id: data.ownerId, deletedAt: null },
	});
	if (!owner) {
		throw Errors.notFound("責任者ユーザーが見つかりません");
	}

	// 副責任者（任意）
	if (data.subOwnerId) {
		const subOwner = await prisma.user.findFirst({
			where: { id: data.subOwnerId, deletedAt: null },
		});
		if (!subOwner) {
			throw Errors.notFound("副責任者ユーザーが見つかりません");
		}
	}

	// 招待コード生成（衝突回避）
	let inviteCode = generateInviteCode();
	while (await prisma.project.findUnique({ where: { inviteCode } })) {
		inviteCode = generateInviteCode();
	}

	const project = await prisma.project.create({
		data: {
			...data,
			subOwnerId: data.subOwnerId ?? null,
			inviteCode,
		},
	});

	return c.json({ project });
});

export { projectRoute };
