// @ts-nocheck - テストファイルでは res.json() の unknown 型を許容
import type { User } from "@prisma/client";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../lib/prisma", () => {
	const prisma = {
		user: { findFirst: vi.fn() },
		committeeMember: { findFirst: vi.fn() },
		project: { findMany: vi.fn(), findFirst: vi.fn() },
		projectPublicInfo: { findFirst: vi.fn(), update: vi.fn() },
		projectPublicInfoModeration: { upsert: vi.fn(), deleteMany: vi.fn() },
		projectPublicMapImage: { updateMany: vi.fn() },
		$transaction: vi.fn(),
	};
	return { prisma };
});

vi.mock("../lib/firebase", () => ({
	auth: { verifyIdToken: vi.fn() },
}));

import { errorHandler } from "../lib/error-handler";
import { auth as firebaseAuth } from "../lib/firebase";
import { prisma } from "../lib/prisma";
import { getPublicApiCacheVersion } from "../lib/public-api-cache";
import { committeePublicInfoRoute } from "./committee-public-info";

const mockPrisma = vi.mocked(prisma, true);
const mockFirebaseAuth = vi.mocked(firebaseAuth, true);

const PROJECT_ID = "clpppppppppppppppp1";
const INFO_ID = "clinfoooooooooooo01";
const MAP_FILE_ID = "clfffffffffffffff02";

const mockUser: User = {
	id: "clxxxxxxxxxxxxxxxxx",
	firebaseUid: "firebase-uid-123",
	email: "s1234567@u.tsukuba.ac.jp",
	name: "筑波太郎",
	namePhonetic: "つくばたろう",
	telephoneNumber: "090-1234-5678",
	deletedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

const mockRow = {
	id: PROJECT_ID,
	number: 1,
	name: "焼きそば屋",
	organizationName: "サークルA",
	type: "FOOD",
	location: "OUTDOOR",
	deletionStatus: null,
	publicInfo: {
		id: INFO_ID,
		description: "焼きそばを販売します",
		iconFileId: null,
		websiteUrls: [],
		xIds: ["sohosai"],
		instagramIds: [],
		youtubeIds: [],
		openStatus: "OPEN",
		stockStatus: "IN_STOCK",
		mapImages: [{ fileId: MAP_FILE_ID, isHidden: true }],
		moderations: [
			{
				field: "DESCRIPTION",
				kind: "HIDDEN",
				updatedAt: new Date(),
				updatedBy: { id: mockUser.id, name: mockUser.name },
			},
		],
	},
};

function makeApp() {
	const app = new Hono();
	app.onError(errorHandler);
	app.route("/committee/public-info", committeePublicInfoRoute);
	return app;
}

function setupAuth(permissions: string[] = ["MAP_APP_SETTING_EDIT"]) {
	mockFirebaseAuth.verifyIdToken.mockResolvedValue({
		uid: "firebase-uid-123",
	} as any);
	mockPrisma.user.findFirst.mockResolvedValue(mockUser);
	mockPrisma.committeeMember.findFirst.mockResolvedValue({
		id: "clyyyyyyyyyyyyyyyyy",
		userId: mockUser.id,
		permissions: permissions.map(permission => ({ permission })),
	} as any);
}

/** 更新系で共通して必要になる DB 応答を用意する */
function setupUpdateMocks() {
	mockPrisma.projectPublicInfo.findFirst.mockResolvedValue({
		id: INFO_ID,
		description: "焼きそばを販売します",
		websiteUrls: [],
		xIds: ["sohosai"],
		instagramIds: [],
		youtubeIds: [],
	} as any);
	mockPrisma.project.findFirst.mockResolvedValue(mockRow as any);
	mockPrisma.$transaction.mockImplementation(async cb => cb(mockPrisma));
}

function request(app: Hono, method: string, path: string, body?: unknown) {
	return app.request(`/committee/public-info${path}`, {
		method,
		headers: {
			Authorization: "Bearer valid-token",
			"Content-Type": "application/json",
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

describe("権限", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("MAP_APP_SETTING_EDIT 権限がなければ一覧も403エラー", async () => {
		const app = makeApp();
		setupAuth([]);

		const res = await request(app, "GET", "");

		expect(res.status).toBe(403);
	});

	it("認証なしで401エラー", async () => {
		const app = makeApp();

		const res = await app.request("/committee/public-info");

		expect(res.status).toBe(401);
	});
});

describe("GET /committee/public-info", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 登録値と非表示・修正の記録を返す", async () => {
		const app = makeApp();
		setupAuth();
		mockPrisma.project.findMany.mockResolvedValue([
			mockRow,
			{ ...mockRow, id: "clpppppppppppppppp2", number: 2, publicInfo: null },
		] as any);

		const res = await request(app, "GET", "");

		expect(res.status).toBe(200);
		const { items } = await res.json();
		// 非表示でも登録値はそのまま返す
		expect(items[0].publicInfo.description).toBe("焼きそばを販売します");
		expect(items[0].moderations[0]).toMatchObject({
			field: "DESCRIPTION",
			kind: "HIDDEN",
		});
		expect(items[0].hiddenMapImageFileIds).toEqual([MAP_FILE_ID]);
		expect(items[1].publicInfo).toBeNull();
		expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { deletedAt: null } })
		);
	});
});

describe("PUT/DELETE /committee/public-info/:projectId/hidden/:field", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 非表示にすると公開APIのキャッシュを破棄する", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		const version = getPublicApiCacheVersion();

		const res = await request(app, "PUT", `/${PROJECT_ID}/hidden/ICON`, {});

		expect(res.status).toBe(200);
		expect(mockPrisma.projectPublicInfoModeration.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					projectPublicInfoId: INFO_ID,
					field: "ICON",
					kind: "HIDDEN",
					updatedById: mockUser.id,
				}),
			})
		);
		expect(getPublicApiCacheVersion()).toBe(version + 1);
	});

	it("正常系: 非表示を解除する", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();

		const res = await request(app, "DELETE", `/${PROJECT_ID}/hidden/ICON`);

		expect(res.status).toBe(200);
		expect(
			mockPrisma.projectPublicInfoModeration.deleteMany
		).toHaveBeenCalledWith({
			where: { projectPublicInfoId: INFO_ID, field: "ICON", kind: "HIDDEN" },
		});
	});

	it("存在しない項目は400エラー", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();

		const res = await request(
			app,
			"PUT",
			`/${PROJECT_ID}/hidden/OPEN_STATUS`,
			{}
		);

		expect(res.status).toBe(400);
	});

	it("企画情報が未登録なら404エラー", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.projectPublicInfo.findFirst.mockResolvedValue(null);

		const res = await request(app, "PUT", `/${PROJECT_ID}/hidden/ICON`, {});

		expect(res.status).toBe(404);
	});
});

describe("PATCH /committee/public-info/:projectId", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 値が変わった項目だけ修正として記録する", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();

		const res = await request(app, "PATCH", `/${PROJECT_ID}`, {
			description: "修正後の紹介文",
			xIds: ["@sohosai"],
		});

		expect(res.status).toBe(200);
		expect(mockPrisma.projectPublicInfo.update).toHaveBeenCalledWith({
			where: { id: INFO_ID },
			data: { description: "修正後の紹介文", xIds: ["sohosai"] },
		});
		expect(mockPrisma.projectPublicInfoModeration.upsert).toHaveBeenCalledTimes(
			1
		);
		expect(mockPrisma.projectPublicInfoModeration.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					field: "DESCRIPTION",
					kind: "CORRECTED",
				}),
			})
		);
	});

	it("紹介文の空文字は null として保存する", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();

		await request(app, "PATCH", `/${PROJECT_ID}`, { description: "" });

		expect(mockPrisma.projectPublicInfo.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: { description: null } })
		);
	});

	it("何も変わらなければ更新しない", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();

		const res = await request(app, "PATCH", `/${PROJECT_ID}`, {
			xIds: ["sohosai"],
		});

		expect(res.status).toBe(200);
		expect(mockPrisma.projectPublicInfo.update).not.toHaveBeenCalled();
		expect(
			mockPrisma.projectPublicInfoModeration.upsert
		).not.toHaveBeenCalled();
	});

	it("不正な形式の値は400エラー", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();

		const res = await request(app, "PATCH", `/${PROJECT_ID}`, {
			websiteUrls: ["javascript:alert(1)"],
		});

		expect(res.status).toBe(400);
	});
});

describe("PUT /committee/public-info/:projectId/map-images/:fileId", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 掲載画像を非表示にする", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.projectPublicMapImage.updateMany.mockResolvedValue({ count: 1 });

		const res = await request(
			app,
			"PUT",
			`/${PROJECT_ID}/map-images/${MAP_FILE_ID}`,
			{ isHidden: true }
		);

		expect(res.status).toBe(200);
		expect(mockPrisma.projectPublicMapImage.updateMany).toHaveBeenCalledWith({
			where: { projectPublicInfoId: INFO_ID, fileId: MAP_FILE_ID },
			data: { isHidden: true },
		});
	});

	it("その企画の掲載画像でなければ404エラー", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.projectPublicMapImage.updateMany.mockResolvedValue({ count: 0 });

		const res = await request(app, "PUT", `/${PROJECT_ID}/map-images/other`, {
			isHidden: true,
		});

		expect(res.status).toBe(404);
	});
});
