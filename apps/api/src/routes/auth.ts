import {
	registerRequestSchema,
	startEmailVerificationRequestSchema,
	verifyEmailRequestSchema,
} from "@sos26/shared";
import { FirebaseAuthError } from "firebase-admin/auth";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import {
	sendAlreadyRegisteredEmail,
	sendVerificationEmail,
} from "../lib/emails";
import { env } from "../lib/env";
import { Errors } from "../lib/error";
import { auth as firebaseAuth } from "../lib/firebase";
import { prisma } from "../lib/prisma";
import { generateVerificationToken, hashToken } from "../lib/token";
import { requireAuth, requireRegTicket } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const authRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// POST /auth/email/start
// メール検証を開始する
// ─────────────────────────────────────────────────────────────
authRoute.post("/email/start", async c => {
	const body = await c.req.json().catch(() => ({}));
	const { email } = startEmailVerificationRequestSchema.parse(body);

	// 既存ユーザーでも常に成功レスポンス（列挙耐性）
	const existingUser = await prisma.user.findUnique({
		where: { email },
	});
	if (existingUser) {
		// 既存ユーザーにも案内メールを送信（列挙対策のためレスポンスは常に同一）
		const loginUrl = `${env.APP_URL}/auth/login`;
		await sendAlreadyRegisteredEmail({ email, loginUrl });
		return c.json({ success: true });
	}

	// 検証トークン生成
	const token = generateVerificationToken();
	const tokenHash = hashToken(token);
	const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分

	// EmailVerification を upsert
	await prisma.emailVerification.upsert({
		where: { email },
		create: {
			email,
			tokenHash,
			expiresAt,
		},
		update: {
			tokenHash,
			expiresAt,
		},
	});

	// 検証メール送信
	const verifyUrl = `${env.APP_URL}/auth/register/verify#${token}`;
	await sendVerificationEmail({ email, verifyUrl });

	return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// POST /auth/email/verify
// メール検証を確定する
// ─────────────────────────────────────────────────────────────
authRoute.post("/email/verify", async c => {
	const body = await c.req.json().catch(() => ({}));
	const { token } = verifyEmailRequestSchema.parse(body);

	const tokenHash = hashToken(token);
	const now = new Date();

	// EmailVerification を原子的に消費
	// トランザクション内で検索・削除を実行
	const verification = await prisma.$transaction(async tx => {
		const found = await tx.emailVerification.findFirst({
			where: {
				tokenHash,
				expiresAt: { gt: now },
			},
		});

		if (!found) {
			return null;
		}

		await tx.emailVerification.delete({
			where: { email: found.email },
		});

		return found;
	});

	if (!verification) {
		throw Errors.tokenInvalid("トークンが無効または期限切れです");
	}

	// reg_ticket 用 Opaque token を生成
	const regTicketToken = generateVerificationToken();
	const regTicketHash = hashToken(regTicketToken);
	const regTicketExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15分

	// RegTicket を email で upsert
	await prisma.regTicket.upsert({
		where: { email: verification.email },
		create: {
			email: verification.email,
			tokenHash: regTicketHash,
			expiresAt: regTicketExpiresAt,
		},
		update: {
			tokenHash: regTicketHash,
			expiresAt: regTicketExpiresAt,
		},
	});

	// reg_ticket Cookie を発行
	setCookie(c, "reg_ticket", regTicketToken, {
		httpOnly: true,
		path: "/auth",
		sameSite: "Lax",
		maxAge: 900, // 15分
		secure: process.env.NODE_ENV === "production",
	});

	return c.json({
		success: true,
		email: verification.email,
	});
});

// ─────────────────────────────────────────────────────────────
// POST /auth/register
// 本登録（Firebaseユーザー作成 + DBユーザー作成）
// ─────────────────────────────────────────────────────────────
authRoute.post("/register", requireRegTicket, async c => {
	const body = await c.req.json().catch(() => ({}));
	const { name, namePhonetic, telephoneNumber, password } =
		registerRequestSchema.parse(body);
	const regTicketRaw = c.get("regTicketRaw");

	const tokenHash = hashToken(regTicketRaw);
	const now = new Date();

	// RegTicket を原子的に消費し email を取得
	const ticket = await prisma.$transaction(async tx => {
		const found = await tx.regTicket.findFirst({
			where: {
				tokenHash,
				expiresAt: { gt: now },
			},
		});

		if (!found) {
			return null;
		}

		await tx.regTicket.delete({
			where: { id: found.id },
		});

		return found;
	});

	// Cookie を削除（成功・失敗に関わらず）
	deleteCookie(c, "reg_ticket", { path: "/auth" });

	if (!ticket) {
		throw Errors.tokenInvalid("登録チケットが無効または期限切れです");
	}

	const email = ticket.email;

	// 既存 User があれば冪等で成功
	const existingUser = await prisma.user.findUnique({
		where: { email },
	});
	if (existingUser) {
		return c.json({ user: existingUser });
	}

	// Firebase Admin で createUser
	let firebaseUid: string;
	try {
		const firebaseUser = await firebaseAuth.createUser({
			email,
			password,
			emailVerified: true,
		});
		firebaseUid = firebaseUser.uid;
	} catch (e) {
		if (e instanceof FirebaseAuthError) {
			switch (e.code) {
				case "auth/email-already-exists":
					throw Errors.alreadyExists(
						"このメールアドレスは既に登録されています"
					);
				case "auth/invalid-password":
					throw Errors.validationError(
						"パスワードは6文字以上で入力してください"
					);
				default:
					console.error("[Auth] Firebase createUser failed", e.code, e.message);
					throw Errors.internal("ユーザー作成に失敗しました");
			}
		}
		console.error("[Auth] Firebase createUser failed (unknown error)", e);
		throw Errors.internal("ユーザー作成に失敗しました");
	}

	// User を作成
	try {
		const user = await prisma.user.create({
			data: {
				firebaseUid,
				email,
				name,
				namePhonetic,
				telephoneNumber,
			},
		});

		return c.json({ user });
	} catch (e) {
		// DB 失敗時は Firebase ユーザーを補償削除
		console.error("[Auth] User creation failed, deleting Firebase user", e);
		try {
			await firebaseAuth.deleteUser(firebaseUid);
		} catch (deleteError) {
			console.error(
				"[Auth] Failed to delete Firebase user for compensation",
				deleteError
			);
		}
		throw Errors.internal("ユーザー作成に失敗しました");
	}
});

// ─────────────────────────────────────────────────────────────
// GET /auth/me
// 現在のログインユーザーを取得
// ─────────────────────────────────────────────────────────────
authRoute.get("/me", requireAuth, async c => {
	const user = c.get("user");
	return c.json({ user });
});

export { authRoute };
