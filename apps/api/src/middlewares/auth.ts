import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { AppError, Errors } from "../lib/error";
import { auth } from "../lib/firebase";
import { prisma } from "../lib/prisma";
import type { AuthEnv } from "../types/auth-env";

/**
 * Firebase ID Token を検証し、ユーザー情報を Context に格納するミドルウェア
 *
 * - Authorization: Bearer <token> ヘッダーから ID Token を取得
 * - Firebase Admin SDK で検証
 * - firebaseUid から User を取得
 * - status == ACTIVE を確認
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
	const authHeader = c.req.header("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		throw Errors.unauthorized("認証が必要です");
	}

	const idToken = authHeader.slice(7);

	try {
		const decodedToken = await auth.verifyIdToken(idToken);
		const user = await prisma.user.findUnique({
			where: { firebaseUid: decodedToken.uid },
		});

		if (!user) {
			throw Errors.notFound("ユーザーが見つかりません");
		}

		if (user.status !== "ACTIVE") {
			throw Errors.forbidden("このアカウントは無効化されています");
		}

		c.set("user", user);
	} catch (e) {
		if (e instanceof AppError) {
			throw e;
		}
		throw Errors.unauthorized("無効なトークンです");
	}

	await next();
});

/**
 * reg_ticket Cookie の存在を確認し、値を Context に格納するミドルウェア
 *
 * - Cookie から reg_ticket を取得
 * - 値を c.set('regTicketRaw', value) に格納
 * - 有効性の検証と消費は /auth/register 内で実施
 */
export const requireRegTicket = createMiddleware<AuthEnv>(async (c, next) => {
	const regTicket = getCookie(c, "reg_ticket");

	if (!regTicket) {
		throw Errors.tokenInvalid("登録チケットがありません");
	}

	c.set("regTicketRaw", regTicket);
	await next();
});
