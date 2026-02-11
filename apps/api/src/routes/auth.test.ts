// @ts-nocheck - テストファイルでは res.json() の unknown 型を許容
import type { User } from "@prisma/client";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// モック（インポート前に定義）
vi.mock("../lib/env", () => ({
	env: {
		PORT: 3000,
		CORS_ORIGIN: ["http://localhost:5173"],
		SENDGRID_API_KEY: "test-sendgrid-key",
		EMAIL_FROM: "test@example.com",
		EMAIL_SANDBOX: true,
		FIREBASE_PROJECT_ID: "test-project",
		FIREBASE_CLIENT_EMAIL: "test@test.iam.gserviceaccount.com",
		FIREBASE_PRIVATE_KEY: "test-private-key",
		APP_URL: "http://localhost:5173",
	},
}));

vi.mock("../lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
		},
		emailVerification: {
			upsert: vi.fn(),
			findFirst: vi.fn(),
			delete: vi.fn(),
		},
		regTicket: {
			upsert: vi.fn(),
			findFirst: vi.fn(),
			delete: vi.fn(),
		},
		$transaction: vi.fn(),
	},
}));

vi.mock("../lib/firebase", () => ({
	auth: {
		verifyIdToken: vi.fn(),
		createUser: vi.fn(),
		deleteUser: vi.fn(),
	},
}));

vi.mock("../lib/emails", () => ({
	sendVerificationEmail: vi.fn(),
	sendAlreadyRegisteredEmail: vi.fn(),
}));

import {
	sendAlreadyRegisteredEmail,
	sendVerificationEmail,
} from "../lib/emails";
import { errorHandler } from "../lib/error-handler";
import { auth as firebaseAuth } from "../lib/firebase";
// モック取得（モック定義後にインポート）
import { prisma } from "../lib/prisma";
import { authRoute } from "./auth";

const mockPrisma = vi.mocked(prisma, true);
const mockFirebaseAuth = vi.mocked(firebaseAuth, true);
const mockSendVerificationEmail = vi.mocked(sendVerificationEmail);
const mockSendAlreadyRegisteredEmail = vi.mocked(sendAlreadyRegisteredEmail);

function makeApp() {
	const app = new Hono();
	app.onError(errorHandler);
	app.route("/auth", authRoute);
	return app;
}

const mockUser: User = {
	id: "clxxxxxxxxxxxxxxxxx",
	firebaseUid: "firebase-uid-123",
	email: "s1234567@u.tsukuba.ac.jp",
	name: "筑波太郎",
	namePhonetic: "ツクバタロウ",
	telephoneNumber: "090-1234-5678",
	deletedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("POST /auth/email/start", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: メール検証を開始する", async () => {
		// Arrange
		const app = makeApp();
		mockPrisma.user.findUnique.mockResolvedValue(null);
		mockPrisma.emailVerification.upsert.mockResolvedValue({
			email: "s1234567@u.tsukuba.ac.jp",
			tokenHash: "hash",
			expiresAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		mockSendVerificationEmail.mockResolvedValue(undefined);

		// Act
		const res = await app.request("/auth/email/start", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "s1234567@u.tsukuba.ac.jp" }),
		});

		// Assert
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ success: true });
		expect(mockSendVerificationEmail).toHaveBeenCalled();
	});

	it("既存ユーザーでも200を返し、既存案内メールを送る（列挙耐性）", async () => {
		// Arrange
		const app = makeApp();
		mockPrisma.user.findUnique.mockResolvedValue(mockUser);

		// Act
		const res = await app.request("/auth/email/start", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "s1234567@u.tsukuba.ac.jp" }),
		});

		// Assert
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ success: true });
		// 確認メールは送らないが、既存案内メールは送る
		expect(mockSendVerificationEmail).not.toHaveBeenCalled();
		expect(mockSendAlreadyRegisteredEmail).toHaveBeenCalled();
	});

	it("不正なメールアドレス形式でバリデーションエラー", async () => {
		// Arrange
		const app = makeApp();

		// Act
		const res = await app.request("/auth/email/start", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "invalid@example.com" }),
		});

		// Assert
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe("VALIDATION_ERROR");
	});
});

describe("POST /auth/email/verify", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: トークン検証成功", async () => {
		// Arrange
		const app = makeApp();
		const mockVerification = {
			email: "s1234567@u.tsukuba.ac.jp",
			tokenHash: "hash",
			expiresAt: new Date(Date.now() + 30 * 60 * 1000),
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		mockPrisma.$transaction.mockImplementation(async callback => {
			const mockTx = {
				emailVerification: {
					findFirst: vi.fn().mockResolvedValue(mockVerification),
					delete: vi.fn().mockResolvedValue(mockVerification),
				},
			};
			return callback(mockTx as any);
		});

		mockPrisma.regTicket.upsert.mockResolvedValue({
			id: "ticket-id",
			email: "s1234567@u.tsukuba.ac.jp",
			tokenHash: "new-hash",
			expiresAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		// Act
		// 43文字以上のbase64url形式のトークン
		const validToken = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
		const res = await app.request("/auth/email/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token: validToken }),
		});

		// Assert
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.email).toBe("s1234567@u.tsukuba.ac.jp");
		// Set-Cookie ヘッダーを確認
		expect(res.headers.get("Set-Cookie")).toContain("reg_ticket=");
	});

	it("無効なトークンでエラー", async () => {
		// Arrange
		const app = makeApp();
		mockPrisma.$transaction.mockImplementation(async callback => {
			const mockTx = {
				emailVerification: {
					findFirst: vi.fn().mockResolvedValue(null),
					delete: vi.fn(),
				},
			};
			return callback(mockTx as any);
		});

		// Act
		const validToken = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
		const res = await app.request("/auth/email/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token: validToken }),
		});

		// Assert
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe("TOKEN_INVALID");
	});
});

describe("POST /auth/register", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: ユーザー登録成功", async () => {
		// Arrange
		const app = makeApp();
		const mockTicket = {
			id: "ticket-id",
			email: "s1234567@u.tsukuba.ac.jp",
			tokenHash: "hash",
			expiresAt: new Date(Date.now() + 15 * 60 * 1000),
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		mockPrisma.$transaction.mockImplementation(async callback => {
			const mockTx = {
				regTicket: {
					findFirst: vi.fn().mockResolvedValue(mockTicket),
					delete: vi.fn().mockResolvedValue(mockTicket),
				},
			};
			return callback(mockTx as any);
		});

		mockPrisma.user.findUnique.mockResolvedValue(null);
		mockFirebaseAuth.createUser.mockResolvedValue({
			uid: "firebase-uid-123",
		} as any);
		mockPrisma.user.create.mockResolvedValue(mockUser);

		// Act
		const regTicketToken = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
		const res = await app.request("/auth/register", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `reg_ticket=${regTicketToken}`,
			},
			body: JSON.stringify({
				name: "筑波太郎",
				namePhonetic: "ツクバタロウ",
				telephoneNumber: "090-1234-5678",
				password: "securepassword123",
			}),
		});

		// Assert
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.user).toBeDefined();
		expect(body.user.email).toBe("s1234567@u.tsukuba.ac.jp");
		expect(mockFirebaseAuth.createUser).toHaveBeenCalled();
	});

	it("Cookie なしでエラー", async () => {
		// Arrange
		const app = makeApp();

		// Act
		const res = await app.request("/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "筑波太郎",
				namePhonetic: "ツクバタロウ",
				telephoneNumber: "090-1234-5678",
				password: "securepassword123",
			}),
		});

		// Assert
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe("TOKEN_INVALID");
	});

	it("無効なチケットでエラー", async () => {
		// Arrange
		const app = makeApp();
		mockPrisma.$transaction.mockImplementation(async callback => {
			const mockTx = {
				regTicket: {
					findFirst: vi.fn().mockResolvedValue(null),
					delete: vi.fn(),
				},
			};
			return callback(mockTx as any);
		});

		// Act
		const regTicketToken = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
		const res = await app.request("/auth/register", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `reg_ticket=${regTicketToken}`,
			},
			body: JSON.stringify({
				name: "筑波太郎",
				namePhonetic: "ツクバタロウ",
				telephoneNumber: "090-1234-5678",
				password: "securepassword123",
			}),
		});

		// Assert
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe("TOKEN_INVALID");
	});

	it("既存ユーザーで冪等成功", async () => {
		// Arrange
		const app = makeApp();
		const mockTicket = {
			id: "ticket-id",
			email: "s1234567@u.tsukuba.ac.jp",
			tokenHash: "hash",
			expiresAt: new Date(Date.now() + 15 * 60 * 1000),
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		mockPrisma.$transaction.mockImplementation(async callback => {
			const mockTx = {
				regTicket: {
					findFirst: vi.fn().mockResolvedValue(mockTicket),
					delete: vi.fn().mockResolvedValue(mockTicket),
				},
			};
			return callback(mockTx as any);
		});

		mockPrisma.user.findUnique.mockResolvedValue(mockUser);

		// Act
		const regTicketToken = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
		const res = await app.request("/auth/register", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `reg_ticket=${regTicketToken}`,
			},
			body: JSON.stringify({
				name: "筑波太郎",
				namePhonetic: "ツクバタロウ",
				telephoneNumber: "090-1234-5678",
				password: "securepassword123",
			}),
		});

		// Assert
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.user).toBeDefined();
		// Firebase createUser は呼ばれない
		expect(mockFirebaseAuth.createUser).not.toHaveBeenCalled();
	});
});

describe("GET /auth/me", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: ユーザー取得", async () => {
		// Arrange
		const app = makeApp();
		mockFirebaseAuth.verifyIdToken.mockResolvedValue({
			uid: "firebase-uid-123",
		} as any);
		mockPrisma.user.findFirst.mockResolvedValue(mockUser);

		// Act
		const res = await app.request("/auth/me", {
			method: "GET",
			headers: {
				Authorization: "Bearer valid-id-token",
			},
		});

		// Assert
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.user).toBeDefined();
		expect(body.user.email).toBe("s1234567@u.tsukuba.ac.jp");
	});

	it("認証ヘッダーなしでエラー", async () => {
		// Arrange
		const app = makeApp();

		// Act
		const res = await app.request("/auth/me", {
			method: "GET",
		});

		// Assert
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error.code).toBe("UNAUTHORIZED");
	});

	it("無効なトークンでエラー", async () => {
		// Arrange
		const app = makeApp();
		mockFirebaseAuth.verifyIdToken.mockRejectedValue(
			new Error("Invalid token")
		);

		// Act
		const res = await app.request("/auth/me", {
			method: "GET",
			headers: {
				Authorization: "Bearer invalid-token",
			},
		});

		// Assert
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error.code).toBe("UNAUTHORIZED");
	});

	it("ユーザーが見つからない場合エラー", async () => {
		// Arrange
		const app = makeApp();
		mockFirebaseAuth.verifyIdToken.mockResolvedValue({
			uid: "firebase-uid-123",
		} as any);
		mockPrisma.user.findFirst.mockResolvedValue(null);

		// Act
		const res = await app.request("/auth/me", {
			method: "GET",
			headers: {
				Authorization: "Bearer valid-id-token",
			},
		});

		// Assert
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error.code).toBe("NOT_FOUND");
	});
});
