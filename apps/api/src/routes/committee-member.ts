import {
	committeePermissionSchema,
	createCommitteeMemberRequestSchema,
	grantCommitteeMemberPermissionRequestSchema,
	updateCommitteeMemberRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeMemberRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// GET /committee/members
// 委員メンバー一覧を取得
// ─────────────────────────────────────────────────────────────
committeeMemberRoute.get("/", requireAuth, requireCommitteeMember, async c => {
	const committeeMembers = await prisma.committeeMember.findMany({
		where: { deletedAt: null },
		include: { user: true, permissions: true },
	});

	return c.json({ committeeMembers });
});

// ─────────────────────────────────────────────────────────────
// POST /committee/members
// 委員メンバーを作成
// ─────────────────────────────────────────────────────────────
committeeMemberRoute.post("/", requireAuth, requireCommitteeMember, async c => {
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
// PATCH /committee/members/:id
// 委員メンバーを更新
// ─────────────────────────────────────────────────────────────
committeeMemberRoute.patch(
	"/:id",
	requireAuth,
	requireCommitteeMember,
	async c => {
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
	}
);

// ─────────────────────────────────────────────────────────────
// DELETE /committee/members/:id
// 委員メンバーをソフトデリート
// ─────────────────────────────────────────────────────────────
committeeMemberRoute.delete(
	"/:id",
	requireAuth,
	requireCommitteeMember,
	async c => {
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
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/members/:id/permissions
// 委員メンバーの権限一覧を取得
// ─────────────────────────────────────────────────────────────
committeeMemberRoute.get(
	"/:id/permissions",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const id = c.req.param("id");

		// TODO: 権限チェックの調整
		// 対象メンバーの存在確認
		const member = await prisma.committeeMember.findFirst({
			where: { id, deletedAt: null },
		});
		if (!member) {
			throw Errors.notFound("委員メンバーが見つかりません");
		}

		const permissions = await prisma.committeeMemberPermission.findMany({
			where: { committeeMemberId: id },
		});

		return c.json({ permissions });
	}
);

// ─────────────────────────────────────────────────────────────
// POST /committee/members/:id/permissions
// 委員メンバーに権限を付与
// ─────────────────────────────────────────────────────────────
committeeMemberRoute.post(
	"/:id/permissions",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const id = c.req.param("id");
		const body = await c.req.json().catch(() => ({}));
		const { permission } =
			grantCommitteeMemberPermissionRequestSchema.parse(body);

		// TODO: 権限チェックの調整
		// 対象メンバーの存在確認
		const member = await prisma.committeeMember.findFirst({
			where: { id, deletedAt: null },
		});
		if (!member) {
			throw Errors.notFound("委員メンバーが見つかりません");
		}

		// 重複チェック
		const existing = await prisma.committeeMemberPermission.findUnique({
			where: {
				committeeMemberId_permission: {
					committeeMemberId: id,
					permission,
				},
			},
		});
		if (existing) {
			throw Errors.alreadyExists("この権限は既に付与されています");
		}

		const created = await prisma.committeeMemberPermission.create({
			data: {
				committeeMemberId: id,
				permission,
			},
		});

		return c.json({ permissionRecord: created });
	}
);

// ─────────────────────────────────────────────────────────────
// DELETE /committee/members/:id/permissions/:permission
// 委員メンバーの権限を削除
// ─────────────────────────────────────────────────────────────
committeeMemberRoute.delete(
	"/:id/permissions/:permission",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const id = c.req.param("id");
		const permission = committeePermissionSchema.parse(
			c.req.param("permission")
		);

		// TODO: 権限チェックの調整
		// 対象メンバーの存在確認
		const member = await prisma.committeeMember.findFirst({
			where: { id, deletedAt: null },
		});
		if (!member) {
			throw Errors.notFound("委員メンバーが見つかりません");
		}

		// 権限レコードの存在確認（compound unique key で検索）
		const existing = await prisma.committeeMemberPermission.findUnique({
			where: {
				committeeMemberId_permission: {
					committeeMemberId: id,
					permission,
				},
			},
		});
		if (!existing) {
			throw Errors.notFound("権限が見つかりません");
		}

		await prisma.committeeMemberPermission.delete({
			where: { id: existing.id },
		});

		return c.json({ success: true });
	}
);

export { committeeMemberRoute };
