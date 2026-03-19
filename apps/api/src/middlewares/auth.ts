import * as Sentry from "@sentry/bun";
import { FirebaseAuthError } from "firebase-admin/auth";
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
 * - firebaseUid から User を取得（deletedAt が null のもの）
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
	const authHeader = c.req.header("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		console.warn("[Auth] Missing or invalid Authorization header", {
			method: c.req.method,
			path: c.req.path,
			origin: c.req.header("Origin") ?? null,
		});
		throw Errors.unauthorized("認証が必要です");
	}

	const idToken = authHeader.slice(7);
	let firebaseUid: string | null = null;

	try {
		const decodedToken = await auth.verifyIdToken(idToken);
		firebaseUid = decodedToken.uid;
		const user = await prisma.user.findFirst({
			where: { firebaseUid: decodedToken.uid, deletedAt: null },
		});

		if (!user) {
			console.warn(
				"[Auth] Verified Firebase token but app user was not found",
				{
					method: c.req.method,
					path: c.req.path,
					firebaseUid,
				}
			);
			throw Errors.notFound("ユーザーが見つかりません");
		}

		c.set("user", user);
	} catch (e) {
		if (e instanceof AppError) {
			console.warn("[Auth] Authentication rejected with application error", {
				method: c.req.method,
				path: c.req.path,
				firebaseUid,
				code: e.code,
				message: e.message,
			});
			throw e;
		}
		if (e instanceof FirebaseAuthError) {
			console.warn("[Auth] Firebase token verification failed", {
				method: c.req.method,
				path: c.req.path,
				firebaseUid,
				code: e.code,
				message: e.message,
			});
			switch (e.code) {
				case "auth/id-token-expired":
					throw Errors.unauthorized("トークンの有効期限が切れています");
				case "auth/id-token-revoked":
					throw Errors.unauthorized("トークンが無効化されています");
				case "auth/user-disabled":
					throw Errors.forbidden("このアカウントは無効化されています");
				default:
					throw Errors.unauthorized("無効なトークンです");
			}
		}
		console.error("[Auth] Unexpected error while authenticating request", {
			method: c.req.method,
			path: c.req.path,
			firebaseUid,
			error: e,
		});
		Sentry.withScope(scope => {
			scope.setLevel("error");
			scope.setTag("error_kind", "auth_unexpected");
			scope.setContext("request", {
				method: c.req.method,
				path: c.req.path,
				firebaseUid,
			});
			Sentry.captureException(e);
		});
		throw Errors.unauthorized("無効なトークンです");
	}

	await next();
});

/**
 * 実行委員メンバーであることを検証し、Context に格納するミドルウェア
 *
 * - requireAuth が先に実行されている前提（c.get("user") が利用可能）
 * - userId で CommitteeMember を検索（deletedAt が null のもの）
 */
export const requireCommitteeMember = createMiddleware<AuthEnv>(
	async (c, next) => {
		const user = c.get("user");

		const committeeMember = await prisma.committeeMember.findFirst({
			where: { userId: user.id, deletedAt: null },
		});

		if (!committeeMember) {
			throw Errors.forbidden("実委メンバーではありません");
		}

		c.set("committeeMember", committeeMember);
		await next();
	}
);

/**
 * 企画メンバーであることを検証し、Project とロールを Context に格納するミドルウェア
 *
 * - requireAuth が先に実行されている前提（c.get("user") が利用可能）
 * - パスパラメータ projectId から Project を取得
 * - ownerId / subOwnerId / ProjectMember でロールを判定
 */
export const requireProjectMember = createMiddleware<AuthEnv>(
	async (c, next) => {
		const user = c.get("user");
		const projectId = c.req.param("projectId");

		if (!projectId) {
			throw Errors.invalidRequest("projectId が必要です");
		}

		const project = await prisma.project.findFirst({
			where: { id: projectId, deletedAt: null },
		});

		if (!project) {
			throw Errors.notFound("企画が見つかりません");
		}

		let role: "OWNER" | "SUB_OWNER" | "MEMBER";

		if (project.ownerId === user.id) {
			role = "OWNER";
		} else if (project.subOwnerId === user.id) {
			role = "SUB_OWNER";
		} else {
			const membership = await prisma.projectMember.findFirst({
				where: { projectId: project.id, userId: user.id, deletedAt: null },
			});

			if (!membership) {
				throw Errors.forbidden("この企画のメンバーではありません");
			}

			role = "MEMBER";
		}

		c.set("project", project);
		c.set("projectRole", role);
		await next();
	}
);

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
