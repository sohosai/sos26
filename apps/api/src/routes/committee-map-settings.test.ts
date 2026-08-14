// @ts-nocheck - テストファイルでは res.json() の unknown 型を許容
import type { User } from "@prisma/client";
import { DEFAULT_MAP_APP_SETTING } from "@sos26/shared";
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

vi.mock("../lib/prisma", () => ({
	prisma: {
		user: { findFirst: vi.fn() },
		committeeMember: { findFirst: vi.fn() },
		mapAppSetting: { findUnique: vi.fn(), upsert: vi.fn() },
	},
}));

vi.mock("../lib/firebase", () => ({
	auth: { verifyIdToken: vi.fn() },
}));

import { errorHandler } from "../lib/error-handler";
import { auth as firebaseAuth } from "../lib/firebase";
import { prisma } from "../lib/prisma";
import { committeeMapSettingsRoute } from "./committee-map-settings";

const mockPrisma = vi.mocked(prisma, true);
const mockFirebaseAuth = vi.mocked(firebaseAuth, true);

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

const storedSetting = {
	id: "GLOBAL",
	...DEFAULT_MAP_APP_SETTING,
	updatedAt: new Date(),
};

function makeApp() {
	const app = new Hono();
	app.onError(errorHandler);
	app.route("/committee/map-settings", committeeMapSettingsRoute);
	return app;
}

function setupAuth(permissions: string[]) {
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

describe("GET /committee/map-settings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 保存済みの設定を返す", async () => {
		const app = makeApp();
		setupAuth([]);
		mockPrisma.mapAppSetting.findUnique.mockResolvedValue({
			...storedSetting,
			isIconEditable: false,
		} as any);

		const res = await app.request("/committee/map-settings", {
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(200);
		expect((await res.json()).setting.isIconEditable).toBe(false);
	});

	it("未作成なら既定値を返す", async () => {
		const app = makeApp();
		setupAuth([]);
		mockPrisma.mapAppSetting.findUnique.mockResolvedValue(null);

		const res = await app.request("/committee/map-settings", {
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(200);
		expect((await res.json()).setting).toEqual(DEFAULT_MAP_APP_SETTING);
	});

	// 企画側の「企画情報」ページが編集可否の判定に使うため、権限で塞がない
	it("MAP_APP_SETTING_EDIT 権限がなくても取得できる", async () => {
		const app = makeApp();
		setupAuth([]);
		mockPrisma.mapAppSetting.findUnique.mockResolvedValue(storedSetting as any);

		const res = await app.request("/committee/map-settings", {
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(200);
	});

	it("認証なしで401エラー", async () => {
		const app = makeApp();

		const res = await app.request("/committee/map-settings");

		expect(res.status).toBe(401);
	});
});

describe("PUT /committee/map-settings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 権限があれば更新できる", async () => {
		const app = makeApp();
		setupAuth(["MAP_APP_SETTING_EDIT"]);
		mockPrisma.mapAppSetting.upsert.mockResolvedValue({
			...storedSetting,
			isIconEditable: false,
		} as any);

		const res = await app.request("/committee/map-settings", {
			method: "PUT",
			headers: {
				Authorization: "Bearer valid-token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ isIconEditable: false }),
		});

		expect(res.status).toBe(200);
		expect((await res.json()).setting.isIconEditable).toBe(false);
	});

	it("MAP_APP_SETTING_EDIT 権限がないと403エラー", async () => {
		const app = makeApp();
		setupAuth(["MEMBER_EDIT"]);

		const res = await app.request("/committee/map-settings", {
			method: "PUT",
			headers: {
				Authorization: "Bearer valid-token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ isIconEditable: false }),
		});

		expect(res.status).toBe(403);
		expect(mockPrisma.mapAppSetting.upsert).not.toHaveBeenCalled();
	});

	it("実委人でないと403エラー", async () => {
		const app = makeApp();
		mockFirebaseAuth.verifyIdToken.mockResolvedValue({
			uid: "firebase-uid-123",
		} as any);
		mockPrisma.user.findFirst.mockResolvedValue(mockUser);
		mockPrisma.committeeMember.findFirst.mockResolvedValue(null);

		const res = await app.request("/committee/map-settings", {
			method: "PUT",
			headers: {
				Authorization: "Bearer valid-token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ isIconEditable: false }),
		});

		expect(res.status).toBe(403);
	});

	it("不正な値は400エラー", async () => {
		const app = makeApp();
		setupAuth(["MAP_APP_SETTING_EDIT"]);

		const res = await app.request("/committee/map-settings", {
			method: "PUT",
			headers: {
				Authorization: "Bearer valid-token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ isIconEditable: "yes" }),
		});

		expect(res.status).toBe(400);
		expect(mockPrisma.mapAppSetting.upsert).not.toHaveBeenCalled();
	});
});
