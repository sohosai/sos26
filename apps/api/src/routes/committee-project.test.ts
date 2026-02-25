// @ts-nocheck - テストファイルでは res.json() の unknown 型を許容
import type { CommitteeMember, Project, User } from "@prisma/client";
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
			findFirst: vi.fn(),
		},
		project: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			count: vi.fn(),
		},
		projectMember: {
			findMany: vi.fn(),
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
import { committeeProjectRoute } from "./committee-project";

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

const mockSubOwner: User = {
	id: "clzzzzzzzzzzzzzzzz",
	firebaseUid: "firebase-uid-456",
	email: "s7654321@u.tsukuba.ac.jp",
	name: "筑波花子",
	namePhonetic: "ツクバハナコ",
	telephoneNumber: "090-8765-4321",
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

const mockProject: Project = {
	id: "clppppppppppppppppp",
	number: 1,
	name: "テスト企画",
	namePhonetic: "テストキカク",
	organizationName: "テスト団体",
	organizationNamePhonetic: "テストダンタイ",
	type: "NORMAL",
	ownerId: "clxxxxxxxxxxxxxxxxx",
	subOwnerId: "clzzzzzzzzzzzzzzzz",
	inviteCode: "ABC123",
	createdAt: new Date(),
	updatedAt: new Date(),
	deletedAt: null,
};

function makeApp() {
	const app = new Hono();
	app.onError(errorHandler);
	app.route("/committee/projects", committeeProjectRoute);
	return app;
}

/** 認証 + 実委メンバーチェックをセットアップ */
function setupAuth() {
	mockFirebaseAuth.verifyIdToken.mockResolvedValue({
		uid: "firebase-uid-123",
	} as any);
	mockPrisma.user.findFirst.mockResolvedValue(mockUser);
	mockPrisma.committeeMember.findFirst.mockResolvedValue(mockCommitteeMember);
}

describe("GET /committee/projects", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 企画一覧を取得", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.project.findMany.mockResolvedValue([
			{
				...mockProject,
				owner: { name: mockUser.name },
				_count: { projectMembers: 3 },
			},
		] as any);
		mockPrisma.project.count.mockResolvedValue(1);

		const res = await app.request("/committee/projects", {
			method: "GET",
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.projects).toHaveLength(1);
		expect(body.projects[0].name).toBe("テスト企画");
		expect(body.projects[0].memberCount).toBe(3);
		expect(body.projects[0].ownerName).toBe("筑波太郎");
		expect(body.projects[0].inviteCode).toBeUndefined();
		expect(body.projects[0].deletedAt).toBeUndefined();
		expect(body.total).toBe(1);
		// limit未指定のため page/limit はレスポンスに含まれない
		expect(body.page).toBeUndefined();
		expect(body.limit).toBeUndefined();
	});

	it("正常系: typeフィルタ", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.project.findMany.mockResolvedValue([]);
		mockPrisma.project.count.mockResolvedValue(0);

		const res = await app.request("/committee/projects?type=STAGE", {
			method: "GET",
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.projects).toHaveLength(0);
		expect(body.total).toBe(0);

		// findManyにtypeフィルタが渡されていることを確認
		expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ type: "STAGE" }),
			})
		);
	});

	it("正常系: search検索", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.project.findMany.mockResolvedValue([]);
		mockPrisma.project.count.mockResolvedValue(0);

		const res = await app.request(
			"/committee/projects?search=%E3%83%86%E3%82%B9%E3%83%88",
			{
				method: "GET",
				headers: { Authorization: "Bearer valid-token" },
			}
		);

		expect(res.status).toBe(200);
		// OR条件が渡されていることを確認
		expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					OR: expect.arrayContaining([
						expect.objectContaining({
							name: { contains: "テスト", mode: "insensitive" },
						}),
					]),
				}),
			})
		);
	});

	it("正常系: ページネーション", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.project.findMany.mockResolvedValue([]);
		mockPrisma.project.count.mockResolvedValue(25);

		const res = await app.request("/committee/projects?page=2&limit=10", {
			method: "GET",
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.page).toBe(2);
		expect(body.limit).toBe(10);

		// skip/takeが正しいことを確認
		expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				skip: 10,
				take: 10,
			})
		);
	});

	it("認証なしでエラー", async () => {
		const app = makeApp();

		const res = await app.request("/committee/projects", {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});

	it("非委員で403エラー", async () => {
		const app = makeApp();
		mockFirebaseAuth.verifyIdToken.mockResolvedValue({
			uid: "firebase-uid-123",
		} as any);
		mockPrisma.user.findFirst.mockResolvedValue(mockUser);
		mockPrisma.committeeMember.findFirst.mockResolvedValue(null);

		const res = await app.request("/committee/projects", {
			method: "GET",
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(403);
	});
});

describe("GET /committee/projects/:projectId", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 企画詳細を取得（owner/subOwner/memberCount）", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.project.findFirst.mockResolvedValue({
			...mockProject,
			owner: {
				id: mockUser.id,
				name: mockUser.name,
				email: mockUser.email,
			},
			subOwner: {
				id: mockSubOwner.id,
				name: mockSubOwner.name,
				email: mockSubOwner.email,
			},
			_count: { projectMembers: 5 },
		} as any);

		const res = await app.request(`/committee/projects/${mockProject.id}`, {
			method: "GET",
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.project.name).toBe("テスト企画");
		expect(body.project.memberCount).toBe(5);
		expect(body.project.inviteCode).toBeUndefined();
		expect(body.project.deletedAt).toBeUndefined();
		expect(body.project.owner.name).toBe("筑波太郎");
		expect(body.project.owner.telephoneNumber).toBeUndefined();
		expect(body.project.owner.firebaseUid).toBeUndefined();
		expect(body.project.subOwner.name).toBe("筑波花子");
	});

	it("存在しない企画で404", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.project.findFirst.mockResolvedValue(null);

		const res = await app.request("/committee/projects/nonexistent-id", {
			method: "GET",
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(404);
	});
});

describe("GET /committee/projects/:projectId/members", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 企画メンバー一覧を取得（role判定の正確性）", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.project.findFirst.mockResolvedValue(mockProject);
		mockPrisma.projectMember.findMany.mockResolvedValue([
			{
				id: "pm1",
				userId: mockProject.ownerId,
				user: mockUser,
				joinedAt: new Date(),
			},
			{
				id: "pm2",
				userId: mockProject.subOwnerId,
				user: mockSubOwner,
				joinedAt: new Date(),
			},
			{
				id: "pm3",
				userId: "other-user-id",
				user: {
					...mockUser,
					id: "other-user-id",
					name: "一般メンバー",
					email: "s9999999@u.tsukuba.ac.jp",
				},
				joinedAt: new Date(),
			},
		] as any);

		const res = await app.request(
			`/committee/projects/${mockProject.id}/members`,
			{
				method: "GET",
				headers: { Authorization: "Bearer valid-token" },
			}
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.members).toHaveLength(3);
		expect(body.members[0].role).toBe("OWNER");
		expect(body.members[1].role).toBe("SUB_OWNER");
		expect(body.members[2].role).toBe("MEMBER");
	});

	it("存在しない企画で404", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.project.findFirst.mockResolvedValue(null);

		const res = await app.request(
			"/committee/projects/nonexistent-id/members",
			{
				method: "GET",
				headers: { Authorization: "Bearer valid-token" },
			}
		);

		expect(res.status).toBe(404);
	});
});
