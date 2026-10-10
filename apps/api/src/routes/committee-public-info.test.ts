// @ts-nocheck - テストファイルでは res.json() の unknown 型を許容
import { Prisma, type User } from "@prisma/client";
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
		projectPublicInfo: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
		projectPublicInfoModeration: {
			upsert: vi.fn(),
			deleteMany: vi.fn(),
			findUnique: vi.fn(),
			delete: vi.fn(),
		},
		projectPublicMapImage: {
			updateMany: vi.fn(),
			deleteMany: vi.fn(),
			createMany: vi.fn(),
		},
		file: { findMany: vi.fn() },
		$transaction: vi.fn(),
		$executeRaw: vi.fn(),
	};
	return { prisma };
});

vi.mock("../lib/storage/references", () => ({
	softDeleteUnreferencedFiles: vi.fn(),
}));

vi.mock("../lib/firebase", () => ({
	auth: { verifyIdToken: vi.fn() },
}));

import { errorHandler } from "../lib/error-handler";
import { auth as firebaseAuth } from "../lib/firebase";
import { prisma } from "../lib/prisma";
import { getPublicApiCacheVersion } from "../lib/public-api-cache";
import { softDeleteUnreferencedFiles } from "../lib/storage/references";
import { committeePublicInfoRoute } from "./committee-public-info";

const mockPrisma = vi.mocked(prisma, true);
const mockFirebaseAuth = vi.mocked(firebaseAuth, true);

const PROJECT_ID = "clpppppppppppppppp1";
const INFO_ID = "clinfoooooooooooo01";
const MAP_FILE_ID = "clfffffffffffffff02";
const ICON_FILE_ID = "clfffffffffffffff01";
const NEW_FILE_ID = "clfffffffffffffff03";

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
	publicInfo: {
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
	const info = {
		id: INFO_ID,
		description: "焼きそばを販売します",
		iconFileId: ICON_FILE_ID,
		websiteUrls: [],
		xIds: ["sohosai"],
		instagramIds: [],
		youtubeIds: [],
		openStatus: "OPEN",
		stockStatus: "IN_STOCK",
		mapImages: [{ fileId: MAP_FILE_ID, isHidden: true }],
		moderations: [],
	};
	mockPrisma.projectPublicInfo.findFirst.mockResolvedValue(info as any);
	mockPrisma.project.findFirst.mockResolvedValue({
		...mockRow,
		publicInfo: info,
	} as any);
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

	it("MAP_APP_SETTING_EDIT 権限がなければ403エラー", async () => {
		const app = makeApp();
		setupAuth([]);

		const res = await request(app, "PUT", `/${PROJECT_ID}/hidden/ICON`, {});

		expect(res.status).toBe(403);
	});

	it("認証なしで401エラー", async () => {
		const app = makeApp();

		const res = await app.request(
			`/committee/public-info/${PROJECT_ID}/hidden/ICON`,
			{ method: "PUT" }
		);

		expect(res.status).toBe(401);
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
		const { project } = await res.json();
		// 非表示でも登録値はそのまま返す
		expect(project.publicInfo.description).toBe("焼きそばを販売します");
		expect(project.hiddenMapImageFileIds).toEqual([MAP_FILE_ID]);
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

	it("掲載画像は項目全体では非表示にできない（1枚ごとに扱う）", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();

		const res = await request(
			app,
			"PUT",
			`/${PROJECT_ID}/hidden/MAP_IMAGES`,
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
				// 再修正では修正前の値を書き換えない
				update: { updatedById: mockUser.id },
				create: expect.objectContaining({
					field: "DESCRIPTION",
					kind: "CORRECTED",
					previousValue: "焼きそばを販売します",
				}),
			})
		);
	});

	it("企画情報を読む前に、同じ企画への保存・修正と直列にするロックを取る", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();

		await request(app, "PATCH", `/${PROJECT_ID}`, {
			description: "修正後の紹介文",
		});

		expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
		expect(mockPrisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
			mockPrisma.project.findFirst.mock.invocationCallOrder[0]
		);
	});

	it("正常系: 再修正で修正前の値に戻すと、修正の記録を消す", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.project.findFirst.mockResolvedValue({
			publicInfo: {
				id: INFO_ID,
				description: "実委が修正した紹介文",
				iconFileId: null,
				websiteUrls: [],
				xIds: [],
				instagramIds: [],
				youtubeIds: [],
				mapImages: [],
				moderations: [
					{ field: "DESCRIPTION", previousValue: "焼きそばを販売します" },
				],
			},
		} as any);

		const res = await request(app, "PATCH", `/${PROJECT_ID}`, {
			description: "焼きそばを販売します",
		});

		expect(res.status).toBe(200);
		expect(
			mockPrisma.projectPublicInfoModeration.deleteMany
		).toHaveBeenCalledWith({
			where: {
				projectPublicInfoId: INFO_ID,
				field: "DESCRIPTION",
				kind: "CORRECTED",
			},
		});
		expect(
			mockPrisma.projectPublicInfoModeration.upsert
		).not.toHaveBeenCalled();
	});

	it("アイコンに触れない修正では、アイコンを回収対象にしない", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();

		await request(app, "PATCH", `/${PROJECT_ID}`, {
			description: "修正後の紹介文",
		});

		expect(softDeleteUnreferencedFiles).toHaveBeenCalledWith(
			[ICON_FILE_ID, MAP_FILE_ID],
			[ICON_FILE_ID, MAP_FILE_ID]
		);
	});

	it("正常系: 企画情報が未登録なら作成し、修正前の値を未入力として記録する", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.project.findFirst.mockResolvedValue({
			...mockRow,
			publicInfo: null,
		} as any);
		mockPrisma.projectPublicInfo.create.mockResolvedValue({
			id: INFO_ID,
		} as any);

		const res = await request(app, "PATCH", `/${PROJECT_ID}`, {
			description: "実委が書いた紹介文",
		});

		expect(res.status).toBe(200);
		expect(mockPrisma.projectPublicInfo.create).toHaveBeenCalledWith({
			data: { projectId: PROJECT_ID },
			select: { id: true },
		});
		expect(mockPrisma.projectPublicInfo.update).toHaveBeenCalledWith({
			where: { id: INFO_ID },
			data: { description: "実委が書いた紹介文" },
		});
		expect(mockPrisma.projectPublicInfoModeration.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					projectPublicInfoId: INFO_ID,
					field: "DESCRIPTION",
					previousValue: Prisma.JsonNull,
				}),
			})
		);
	});

	it("企画情報が未登録で値が変わらなければ、企画情報を作らない", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.project.findFirst.mockResolvedValue({
			...mockRow,
			publicInfo: null,
		} as any);

		const res = await request(app, "PATCH", `/${PROJECT_ID}`, {
			description: "",
		});

		expect(res.status).toBe(200);
		expect(mockPrisma.projectPublicInfo.create).not.toHaveBeenCalled();
	});

	it("企画が存在しなければ404エラー", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.project.findFirst.mockResolvedValue(null);

		const res = await request(app, "PATCH", `/${PROJECT_ID}`, {
			description: "紹介文",
		});

		expect(res.status).toBe(404);
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

	it("正常系: アイコンを差し替えると修正前のアイコンを記録し、差し替え前のファイルを回収対象にする", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.file.findMany.mockResolvedValue([
			{ id: NEW_FILE_ID, mimeType: "image/png", uploadedById: mockUser.id },
		] as any);

		const res = await request(app, "PATCH", `/${PROJECT_ID}`, {
			iconFileId: NEW_FILE_ID,
		});

		expect(res.status).toBe(200);
		expect(mockPrisma.projectPublicInfo.update).toHaveBeenCalledWith({
			where: { id: INFO_ID },
			data: { iconFileId: NEW_FILE_ID },
		});
		expect(mockPrisma.projectPublicInfoModeration.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					field: "ICON",
					previousValue: ICON_FILE_ID,
				}),
			})
		);
		// 修正前のアイコンは findReferencedFileIds が修正の記録から参照中と判定して残す
		expect(softDeleteUnreferencedFiles).toHaveBeenCalledWith(
			[ICON_FILE_ID, MAP_FILE_ID],
			[NEW_FILE_ID, MAP_FILE_ID]
		);
	});

	it("正常系: 掲載画像を追加すると、既存の画像の非表示を引き継ぐ", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.file.findMany.mockResolvedValue([
			{ id: MAP_FILE_ID, mimeType: "image/png", uploadedById: "clother" },
			{ id: NEW_FILE_ID, mimeType: "image/png", uploadedById: mockUser.id },
		] as any);

		const res = await request(app, "PATCH", `/${PROJECT_ID}`, {
			mapImageFileIds: [MAP_FILE_ID, NEW_FILE_ID],
		});

		expect(res.status).toBe(200);
		expect(mockPrisma.projectPublicMapImage.createMany).toHaveBeenCalledWith({
			data: [
				{
					projectPublicInfoId: INFO_ID,
					fileId: MAP_FILE_ID,
					sortOrder: 0,
					isHidden: true,
				},
				{
					projectPublicInfoId: INFO_ID,
					fileId: NEW_FILE_ID,
					sortOrder: 1,
					isHidden: false,
				},
			],
		});
		expect(mockPrisma.projectPublicInfoModeration.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					field: "MAP_IMAGES",
					previousValue: [MAP_FILE_ID],
				}),
			})
		);
	});

	it("他の人がアップロードした、企画情報に付いていないファイルは403エラー", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.file.findMany.mockResolvedValue([
			{ id: NEW_FILE_ID, mimeType: "image/png", uploadedById: "clother" },
		] as any);

		const res = await request(app, "PATCH", `/${PROJECT_ID}`, {
			iconFileId: NEW_FILE_ID,
		});

		expect(res.status).toBe(403);
		expect(mockPrisma.projectPublicInfo.update).not.toHaveBeenCalled();
	});

	it("画像でないファイルは400エラー", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.file.findMany.mockResolvedValue([
			{
				id: NEW_FILE_ID,
				mimeType: "application/pdf",
				uploadedById: mockUser.id,
			},
		] as any);

		const res = await request(app, "PATCH", `/${PROJECT_ID}`, {
			iconFileId: NEW_FILE_ID,
		});

		expect(res.status).toBe(400);
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

describe("DELETE /committee/public-info/:projectId/corrections/:field", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 修正前の値に戻し、修正の記録を消す", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.projectPublicInfoModeration.findUnique.mockResolvedValue({
			id: "clmodddddddddddddd1",
			previousValue: ["original"],
		} as any);
		const version = getPublicApiCacheVersion();

		const res = await request(
			app,
			"DELETE",
			`/${PROJECT_ID}/corrections/X_IDS`
		);

		expect(res.status).toBe(200);
		expect(mockPrisma.projectPublicInfo.update).toHaveBeenCalledWith({
			where: { id: INFO_ID },
			data: { xIds: ["original"] },
		});
		expect(mockPrisma.projectPublicInfoModeration.delete).toHaveBeenCalledWith({
			where: { id: "clmodddddddddddddd1" },
		});
		expect(getPublicApiCacheVersion()).toBe(version + 1);
	});

	it("修正前の値が文字列・配列でなければ、未入力として戻す", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.projectPublicInfoModeration.findUnique.mockResolvedValue({
			id: "clmodddddddddddddd1",
			previousValue: {},
		} as any);

		const res = await request(
			app,
			"DELETE",
			`/${PROJECT_ID}/corrections/DESCRIPTION`
		);

		expect(res.status).toBe(200);
		expect(mockPrisma.projectPublicInfo.update).toHaveBeenCalledWith({
			where: { id: INFO_ID },
			data: { description: null },
		});
	});

	it("修正の記録がなければ404エラー", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.projectPublicInfoModeration.findUnique.mockResolvedValue(null);

		const res = await request(
			app,
			"DELETE",
			`/${PROJECT_ID}/corrections/DESCRIPTION`
		);

		expect(res.status).toBe(404);
		expect(mockPrisma.projectPublicInfo.update).not.toHaveBeenCalled();
	});

	it("正常系: 掲載画像を修正前に戻すと、残る画像の非表示を引き継ぎ、外れた画像を回収する", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();
		mockPrisma.projectPublicInfoModeration.findUnique.mockResolvedValue({
			id: "clmodddddddddddddd1",
			previousValue: [MAP_FILE_ID, NEW_FILE_ID],
		} as any);

		const res = await request(
			app,
			"DELETE",
			`/${PROJECT_ID}/corrections/MAP_IMAGES`
		);

		expect(res.status).toBe(200);
		expect(mockPrisma.projectPublicMapImage.createMany).toHaveBeenCalledWith({
			data: [
				{
					projectPublicInfoId: INFO_ID,
					fileId: MAP_FILE_ID,
					sortOrder: 0,
					isHidden: true,
				},
				{
					projectPublicInfoId: INFO_ID,
					fileId: NEW_FILE_ID,
					sortOrder: 1,
					isHidden: false,
				},
			],
		});
		expect(softDeleteUnreferencedFiles).toHaveBeenCalledWith(
			[ICON_FILE_ID, MAP_FILE_ID],
			[ICON_FILE_ID, MAP_FILE_ID, NEW_FILE_ID]
		);
	});

	it("存在しない項目は400エラー", async () => {
		const app = makeApp();
		setupAuth();
		setupUpdateMocks();

		const res = await request(
			app,
			"DELETE",
			`/${PROJECT_ID}/corrections/OPEN_STATUS`
		);

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
