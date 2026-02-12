import {
	createCommitteeMemberRequestSchema,
	updateCommitteeMemberRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeMemberRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// GET /committee-members
// 委員メンバー一覧を取得
// ─────────────────────────────────────────────────────────────
committeeMemberRoute.get("/", requireAuth, async c => {
	const committeeMembers = await prisma.committeeMember.findMany({
		where: { deletedAt: null },
		include: { user: true },
	});

	return c.json({ committeeMembers });
});

// ─────────────────────────────────────────────────────────────
// POST /committee-members
// 委員メンバーを作成
// ─────────────────────────────────────────────────────────────
committeeMemberRoute.post("/", requireAuth, async c => {
	const body = await c.req.json().catch(() => ({}));
	const { userId, Bureau, isExecutive } =
		createCommitteeMemberRequestSchema.parse(body);

	// ユーザー存在確認
	const user = await prisma.user.findFirst({
		where: { id: userId, deletedAt: null },
	});
	if (!user) {
		throw Errors.notFound("ユーザーが見つかりません");
	}

	// 既存チェック（ソフトデリート済みも含めて検索）
	const existing = await prisma.committeeMember.findUnique({
		where: { userId },
	});

	if (existing) {
		if (!existing.deletedAt) {
			throw Errors.alreadyExists("このユーザーは既に委員メンバーです");
		}

		// ソフトデリート済み → 再有効化
		const reactivated = await prisma.committeeMember.update({
			where: { id: existing.id },
			data: {
				Bureau,
				isExecutive: isExecutive ?? false,
				deletedAt: null,
				joinedAt: new Date(),
			},
		});

		return c.json({ committeeMember: reactivated });
	}

	// 新規作成
	const committeeMember = await prisma.committeeMember.create({
		data: {
			userId,
			Bureau,
			isExecutive: isExecutive ?? false,
		},
	});

	return c.json({ committeeMember });
});

// ─────────────────────────────────────────────────────────────
// PATCH /committee-members/:id
// 委員メンバーを更新
// ─────────────────────────────────────────────────────────────
committeeMemberRoute.patch("/:id", requireAuth, async c => {
	const id = c.req.param("id");
	const body = await c.req.json().catch(() => ({}));
	const data = updateCommitteeMemberRequestSchema.parse(body);

	// 存在確認
	const existing = await prisma.committeeMember.findFirst({
		where: { id, deletedAt: null },
	});
	if (!existing) {
		throw Errors.notFound("委員メンバーが見つかりません");
	}

	const committeeMember = await prisma.committeeMember.update({
		where: { id },
		data,
	});

	return c.json({ committeeMember });
});

// ─────────────────────────────────────────────────────────────
// DELETE /committee-members/:id
// 委員メンバーをソフトデリート
// ─────────────────────────────────────────────────────────────
committeeMemberRoute.delete("/:id", requireAuth, async c => {
	const id = c.req.param("id");

	// 存在確認
	const existing = await prisma.committeeMember.findFirst({
		where: { id, deletedAt: null },
	});
	if (!existing) {
		throw Errors.notFound("委員メンバーが見つかりません");
	}

	await prisma.committeeMember.update({
		where: { id },
		data: { deletedAt: new Date() },
	});

	return c.json({ success: true });
});

export { committeeMemberRoute };
