import { updateUserSettingsRequestSchema } from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const userRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// GET /user/settings
// 現在のユーザーの設定を取得
// ─────────────────────────────────────────────────────────────
userRoute.get("/settings", requireAuth, async c => {
	const user = c.get("user");

	return c.json({
		avatarFileId: user.avatarFileId,
		sendKey: user.sendKey,
	});
});

// ─────────────────────────────────────────────────────────────
// PATCH /user/settings
// 現在のユーザーの設定を更新
// ─────────────────────────────────────────────────────────────
userRoute.patch("/settings", requireAuth, async c => {
	const currentUser = c.get("user");
	const body = await c.req.json().catch(() => ({}));
	const data = updateUserSettingsRequestSchema.parse(body);

	// avatarFileId が指定された場合、ファイルの存在と所有者を確認
	if (data.avatarFileId !== undefined && data.avatarFileId !== null) {
		const file = await prisma.file.findFirst({
			where: {
				id: data.avatarFileId,
				uploadedById: currentUser.id,
				status: "CONFIRMED",
				deletedAt: null,
			},
		});
		if (!file) {
			throw Errors.notFound("ファイルが見つかりません");
		}
	}

	const user = await prisma.user.update({
		where: { id: currentUser.id },
		data: {
			...(data.avatarFileId !== undefined && {
				avatarFileId: data.avatarFileId,
			}),
			...(data.sendKey !== undefined && { sendKey: data.sendKey }),
		},
	});

	return c.json({ user });
});

export { userRoute };
