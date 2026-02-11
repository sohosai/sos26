// @ts-nocheck - テストファイルでは res.json() の unknown 型を許容
import type { CommitteeMember, User } from "@prisma/client";
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
			findFirst: vi.fn(),
		},
		committeeMember: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
		},
	},
}));

vi.mock("../lib/firebase", () => ({
	auth: {
		verifyIdToken: vi.fn(),
	},
}));

import { errorHandler } from "../lib/error-handler";
import { auth as firebaseAuth } from "../lib/firebase";
import { prisma } from "../lib/prisma";
import { committeeMemberRoute } from "./committee-member";

const mockPrisma = vi.mocked(prisma, true);
const mockFirebaseAuth = vi.mocked(firebaseAuth, true);

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

const mockCommitteeMember: CommitteeMember = {
	id: "clyyyyyyyyyyyyyyyyy",
	userId: "clxxxxxxxxxxxxxxxxx",
	isExecutive: false,
	Bureau: "INFO_SYSTEM",
	joinedAt: new Date(),
	deletedAt: null,
};

function makeApp() {
	const app = new Hono();
	app.onError(errorHandler);
	app.route("/committee-members", committeeMemberRoute);
	return app;
}

/** 認証ヘッダーをセットアップ */
function setupAuth() {
	mockFirebaseAuth.verifyIdToken.mockResolvedValue({
		uid: "firebase-uid-123",
	} as any);
	mockPrisma.user.findFirst.mockResolvedValue(mockUser);
}

describe("GET /committee-members", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 委員メンバー一覧を取得", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.committeeMember.findMany.mockResolvedValue([
			{ ...mockCommitteeMember, user: mockUser },
		] as any);

		const res = await app.request("/committee-members", {
			method: "GET",
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.committeeMembers).toHaveLength(1);
		expect(body.committeeMembers[0].Bureau).toBe("INFO_SYSTEM");
	});

	it("認証なしでエラー", async () => {
		const app = makeApp();

		const res = await app.request("/committee-members", {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});
});

describe("POST /committee-members", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 委員メンバーを作成", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.user.findFirst.mockResolvedValue(mockUser);
		mockPrisma.committeeMember.findUnique.mockResolvedValue(null);
		mockPrisma.committeeMember.create.mockResolvedValue(mockCommitteeMember);

		const res = await app.request("/committee-members", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer valid-token",
			},
			body: JSON.stringify({
				userId: "clxxxxxxxxxxxxxxxxx",
				Bureau: "INFO_SYSTEM",
			}),
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.committeeMember).toBeDefined();
		expect(body.committeeMember.Bureau).toBe("INFO_SYSTEM");
	});

	it("既存メンバーでエラー", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.user.findFirst.mockResolvedValue(mockUser);
		mockPrisma.committeeMember.findUnique.mockResolvedValue(
			mockCommitteeMember
		);

		const res = await app.request("/committee-members", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer valid-token",
			},
			body: JSON.stringify({
				userId: "clxxxxxxxxxxxxxxxxx",
				Bureau: "INFO_SYSTEM",
			}),
		});

		expect(res.status).toBe(409);
		const body = await res.json();
		expect(body.error.code).toBe("ALREADY_EXISTS");
	});

	it("ソフトデリート済みのメンバーを再有効化", async () => {
		const app = makeApp();
		setupAuth();
		const deletedMember = {
			...mockCommitteeMember,
			deletedAt: new Date(),
		};
		mockPrisma.user.findFirst.mockResolvedValue(mockUser);
		mockPrisma.committeeMember.findUnique.mockResolvedValue(deletedMember);
		mockPrisma.committeeMember.update.mockResolvedValue({
			...mockCommitteeMember,
			Bureau: "FINANCE",
			deletedAt: null,
		});

		const res = await app.request("/committee-members", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer valid-token",
			},
			body: JSON.stringify({
				userId: "clxxxxxxxxxxxxxxxxx",
				Bureau: "FINANCE",
			}),
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.committeeMember.Bureau).toBe("FINANCE");
		expect(body.committeeMember.deletedAt).toBeNull();
	});

	it("存在しないユーザーでエラー", async () => {
		const app = makeApp();
		setupAuth();
		// requireAuth用にfindFirstが最初に呼ばれ、その後POST内で再度呼ばれる
		mockPrisma.user.findFirst
			.mockResolvedValueOnce(mockUser) // requireAuth
			.mockResolvedValueOnce(null); // POST内のユーザー存在確認

		const res = await app.request("/committee-members", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer valid-token",
			},
			body: JSON.stringify({
				userId: "nonexistent-user-id",
				Bureau: "INFO_SYSTEM",
			}),
		});

		expect(res.status).toBe(404);
	});

	it("不正なBureauでバリデーションエラー", async () => {
		const app = makeApp();
		setupAuth();

		const res = await app.request("/committee-members", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer valid-token",
			},
			body: JSON.stringify({
				userId: "clxxxxxxxxxxxxxxxxx",
				Bureau: "INVALID_BUREAU",
			}),
		});

		expect(res.status).toBe(400);
	});
});

describe("PATCH /committee-members/:id", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 委員メンバーを更新", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.committeeMember.findFirst.mockResolvedValue(mockCommitteeMember);
		mockPrisma.committeeMember.update.mockResolvedValue({
			...mockCommitteeMember,
			Bureau: "FINANCE",
			isExecutive: true,
		});

		const res = await app.request(
			`/committee-members/${mockCommitteeMember.id}`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer valid-token",
				},
				body: JSON.stringify({
					Bureau: "FINANCE",
					isExecutive: true,
				}),
			}
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.committeeMember.Bureau).toBe("FINANCE");
		expect(body.committeeMember.isExecutive).toBe(true);
	});

	it("存在しないメンバーでエラー", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.committeeMember.findFirst.mockResolvedValue(null);

		const res = await app.request("/committee-members/nonexistent-id", {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer valid-token",
			},
			body: JSON.stringify({ Bureau: "FINANCE" }),
		});

		expect(res.status).toBe(404);
	});
});

describe("DELETE /committee-members/:id", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 委員メンバーをソフトデリート", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.committeeMember.findFirst.mockResolvedValue(mockCommitteeMember);
		mockPrisma.committeeMember.update.mockResolvedValue({
			...mockCommitteeMember,
			deletedAt: new Date(),
		});

		const res = await app.request(
			`/committee-members/${mockCommitteeMember.id}`,
			{
				method: "DELETE",
				headers: { Authorization: "Bearer valid-token" },
			}
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});

	it("存在しないメンバーでエラー", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.committeeMember.findFirst.mockResolvedValue(null);

		const res = await app.request("/committee-members/nonexistent-id", {
			method: "DELETE",
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(404);
	});
});
