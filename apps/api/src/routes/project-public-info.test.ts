// @ts-nocheck - テストファイルでは res.json() の unknown 型を許容
import type { Project, User } from "@prisma/client";
import { PROJECT_DESCRIPTION_MAX_LENGTH } from "@sos26/shared";
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

vi.mock("../lib/prisma", () => {
	const prisma = {
		user: { findFirst: vi.fn(), findMany: vi.fn() },
		project: { findFirst: vi.fn() },
		projectMember: { findFirst: vi.fn(), findMany: vi.fn() },
		projectPublicInfo: {
			findUnique: vi.fn(),
			findUniqueOrThrow: vi.fn(),
			findMany: vi.fn(),
			upsert: vi.fn(),
		},
		projectPublicMapImage: {
			findMany: vi.fn(),
			deleteMany: vi.fn(),
			createMany: vi.fn(),
		},
		// findReferencedFileIds が確認する、他機能側のファイル参照先
		noticeAttachment: { findMany: vi.fn() },
		inquiryAttachment: { findMany: vi.fn() },
		formAttachment: { findMany: vi.fn() },
		formAnswerFile: { findMany: vi.fn() },
		formItemEditHistoryFile: { findMany: vi.fn() },
		projectRegistrationFormItemEditHistoryFile: { findMany: vi.fn() },
		projectRegistrationFormAnswerFile: { findMany: vi.fn() },
		mapAppSetting: { findUnique: vi.fn() },
		file: { findMany: vi.fn(), updateMany: vi.fn() },
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
import { projectPublicInfoRoute } from "./project-public-info";

const mockPrisma = vi.mocked(prisma, true);
const mockFirebaseAuth = vi.mocked(firebaseAuth, true);

const OWNER_ID = "clxxxxxxxxxxxxxxxxx";
const OTHER_USER_ID = "clzzzzzzzzzzzzzzzzz";
const PROJECT_ID = "clpppppppppppppppp1";
const ICON_FILE_ID = "clfffffffffffffff01";
const MAP_FILE_ID = "clfffffffffffffff02";

const mockUser: User = {
	id: OWNER_ID,
	firebaseUid: "firebase-uid-123",
	email: "s1234567@u.tsukuba.ac.jp",
	name: "筑波太郎",
	namePhonetic: "つくばたろう",
	telephoneNumber: "090-1234-5678",
	deletedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

const mockProject = {
	id: PROJECT_ID,
	name: "焼きそば屋",
	type: "FOOD",
	location: "OUTDOOR",
	ownerId: OWNER_ID,
	subOwnerId: null,
	deletionStatus: null,
	deletedAt: null,
} as unknown as Project;

function makeApp() {
	const app = new Hono();
	app.onError(errorHandler);
	app.route("/project", projectPublicInfoRoute);
	return app;
}

/** 認証を通し、リクエスト元を企画責任者にする */
function setupAuthAsOwner(project: Partial<Project> = {}) {
	mockFirebaseAuth.verifyIdToken.mockResolvedValue({
		uid: "firebase-uid-123",
	} as any);
	mockPrisma.user.findFirst.mockResolvedValue(mockUser);
	mockPrisma.project.findFirst.mockResolvedValue({
		...mockProject,
		...project,
	} as any);
}

/** 認証を通し、リクエスト元を一般メンバーにする */
function setupAuthAsMember() {
	mockFirebaseAuth.verifyIdToken.mockResolvedValue({
		uid: "firebase-uid-123",
	} as any);
	mockPrisma.user.findFirst.mockResolvedValue(mockUser);
	mockPrisma.project.findFirst.mockResolvedValue({
		...mockProject,
		ownerId: OTHER_USER_ID,
	} as any);
	mockPrisma.projectMember.findFirst.mockResolvedValue({
		id: "clmmmmmmmmmmmmmmmm1",
	} as any);
}

/** 更新系で共通して必要になる DB 応答を用意する */
function setupUpdateMocks(
	options: {
		files?: {
			id: string;
			mimeType: string;
			uploadedById: string;
			isPublic?: boolean;
		}[];
		before?: {
			iconFileId: string | null;
			mapImages: { fileId: string }[];
		} | null;
		saved?: Record<string, unknown>;
	} = {}
) {
	const {
		files = [
			{
				id: ICON_FILE_ID,
				mimeType: "image/png",
				uploadedById: OWNER_ID,
				isPublic: true,
			},
			{
				id: MAP_FILE_ID,
				mimeType: "image/jpeg",
				uploadedById: OWNER_ID,
				isPublic: true,
			},
		],
		before = null,
		saved = {},
	} = options;

	// 実際の findMany と同じく、要求された ID と isPublic 条件に合致するものだけを返す
	mockPrisma.file.findMany.mockImplementation(async (args: any) =>
		files.filter(
			f =>
				(args?.where?.id?.in ?? []).includes(f.id) &&
				(f.isPublic ?? true) === (args?.where?.isPublic ?? true)
		)
	);
	mockPrisma.projectMember.findMany.mockResolvedValue([
		{ userId: OWNER_ID },
	] as any);
	mockPrisma.projectPublicInfo.findUnique.mockResolvedValue(before as any);
	mockPrisma.projectPublicInfo.upsert.mockResolvedValue({
		id: "clinfoooooooooooo01",
	} as any);
	mockPrisma.projectPublicInfo.findUniqueOrThrow.mockResolvedValue({
		id: "clinfoooooooooooo01",
		description: null,
		iconFileId: null,
		openStatus: "NOT_APPLICABLE",
		stockStatus: "NOT_APPLICABLE",
		mapImages: [],
		...saved,
	} as any);
	mockPrisma.projectPublicMapImage.deleteMany.mockResolvedValue({ count: 0 });
	mockPrisma.projectPublicMapImage.createMany.mockResolvedValue({ count: 0 });
	mockPrisma.projectPublicInfo.findMany.mockResolvedValue([]);
	mockPrisma.projectPublicMapImage.findMany.mockResolvedValue([]);
	// findReferencedFileIds が確認する他機能側の参照先。既定では「どこからも参照されていない」
	mockPrisma.user.findMany.mockResolvedValue([]);
	mockPrisma.noticeAttachment.findMany.mockResolvedValue([]);
	mockPrisma.inquiryAttachment.findMany.mockResolvedValue([]);
	mockPrisma.formAttachment.findMany.mockResolvedValue([]);
	mockPrisma.formAnswerFile.findMany.mockResolvedValue([]);
	mockPrisma.formItemEditHistoryFile.findMany.mockResolvedValue([]);
	mockPrisma.projectRegistrationFormItemEditHistoryFile.findMany.mockResolvedValue(
		[]
	);
	mockPrisma.projectRegistrationFormAnswerFile.findMany.mockResolvedValue([]);
	mockPrisma.file.updateMany.mockResolvedValue({ count: 0 });
	mockPrisma.$transaction.mockImplementation(async cb => cb(mockPrisma));
}

function put(app: Hono, body: unknown) {
	return app.request(`/project/${PROJECT_ID}/public-info`, {
		method: "PUT",
		headers: {
			Authorization: "Bearer valid-token",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

describe("GET /project/:projectId/public-info", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正常系: 公開情報を取得する", async () => {
		const app = makeApp();
		setupAuthAsOwner();
		mockPrisma.projectPublicInfo.findUnique.mockResolvedValue({
			description: "焼きそばです",
			iconFileId: ICON_FILE_ID,
			openStatus: "OPEN",
			stockStatus: "IN_STOCK",
			mapImages: [{ fileId: MAP_FILE_ID }],
		} as any);

		const res = await app.request(`/project/${PROJECT_ID}/public-info`, {
			method: "GET",
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.publicInfo.description).toBe("焼きそばです");
		expect(body.publicInfo.mapImageFileIds).toEqual([MAP_FILE_ID]);
	});

	it("未作成の場合は null を返す", async () => {
		const app = makeApp();
		setupAuthAsOwner();
		mockPrisma.projectPublicInfo.findUnique.mockResolvedValue(null);

		const res = await app.request(`/project/${PROJECT_ID}/public-info`, {
			method: "GET",
			headers: { Authorization: "Bearer valid-token" },
		});

		expect(res.status).toBe(200);
		expect((await res.json()).publicInfo).toBeNull();
	});

	it("認証なしで401エラー", async () => {
		const app = makeApp();

		const res = await app.request(`/project/${PROJECT_ID}/public-info`, {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});
});

describe("PUT /project/:projectId/public-info", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrisma.mapAppSetting.findUnique.mockResolvedValue(null);
	});

	describe("権限", () => {
		it("正常系: 企画責任者は保存できる", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks({ saved: { description: "焼きそばです" } });

			const res = await put(app, { description: "焼きそばです" });

			expect(res.status).toBe(200);
			expect((await res.json()).publicInfo.description).toBe("焼きそばです");
		});

		it("一般メンバーは403エラー", async () => {
			const app = makeApp();
			setupAuthAsMember();
			setupUpdateMocks();

			const res = await put(app, { description: "焼きそばです" });

			expect(res.status).toBe(403);
		});

		it("中止・辞退済みの企画は403エラー", async () => {
			const app = makeApp();
			setupAuthAsOwner({ deletionStatus: "PROJECT_WITHDRAWN" });
			setupUpdateMocks();

			const res = await put(app, { description: "焼きそばです" });

			expect(res.status).toBe(403);
		});
	});

	describe("実委人による編集可否設定", () => {
		it("紹介文の編集が無効なら400エラー", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks();
			mockPrisma.mapAppSetting.findUnique.mockResolvedValue({
				isDescriptionEditable: false,
				isIconEditable: true,
				isMapImagesEditable: true,
				isOpenStatusEditable: true,
				isStockStatusEditable: true,
			} as any);

			const res = await put(app, { description: "焼きそばです" });

			expect(res.status).toBe(400);
		});

		it("既定では開店状態を編集できない", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks();

			const res = await put(app, { openStatus: "OPEN" });

			expect(res.status).toBe(400);
		});

		it("編集が無効でも、その項目を送らなければ保存できる", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks({ saved: { description: "焼きそばです" } });
			mockPrisma.mapAppSetting.findUnique.mockResolvedValue({
				isDescriptionEditable: true,
				isIconEditable: false,
				isMapImagesEditable: false,
				isOpenStatusEditable: false,
				isStockStatusEditable: false,
			} as any);

			const res = await put(app, { description: "焼きそばです" });

			expect(res.status).toBe(200);
		});
	});

	describe("ファイルIDの検証", () => {
		it("存在しないファイルIDは400エラー", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks({ files: [] });

			const res = await put(app, { iconFileId: "not-exist" });

			expect(res.status).toBe(400);
			expect(mockPrisma.projectPublicInfo.upsert).not.toHaveBeenCalled();
		});

		it("非公開ファイルは400エラー", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks({
				files: [
					{
						id: ICON_FILE_ID,
						mimeType: "image/png",
						uploadedById: OWNER_ID,
						isPublic: false,
					},
				],
			});

			const res = await put(app, { iconFileId: ICON_FILE_ID });

			expect(res.status).toBe(400);
			expect(mockPrisma.projectPublicInfo.upsert).not.toHaveBeenCalled();
		});

		it("画像以外のファイルは400エラー", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks({
				files: [
					{
						id: ICON_FILE_ID,
						mimeType: "application/pdf",
						uploadedById: OWNER_ID,
					},
				],
			});

			const res = await put(app, { iconFileId: ICON_FILE_ID });

			expect(res.status).toBe(400);
		});

		it("他企画のメンバーがアップロードしたファイルは403エラー", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks({
				files: [
					{
						id: ICON_FILE_ID,
						mimeType: "image/png",
						uploadedById: OTHER_USER_ID,
					},
				],
			});

			const res = await put(app, { iconFileId: ICON_FILE_ID });

			expect(res.status).toBe(403);
		});

		it("同じ画像を複数登録すると400エラー", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks();

			const res = await put(app, {
				mapImageFileIds: [MAP_FILE_ID, MAP_FILE_ID],
			});

			expect(res.status).toBe(400);
		});

		it("アイコン削除（空文字）ではファイル検証を行わない", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks();

			const res = await put(app, { iconFileId: "" });

			expect(res.status).toBe(200);
			expect(mockPrisma.file.findMany).not.toHaveBeenCalled();
		});
	});

	describe("ステージ企画", () => {
		it("開店・在庫状態は NOT_APPLICABLE に強制される", async () => {
			const app = makeApp();
			setupAuthAsOwner({ type: "STAGE", location: "STAGE" });
			setupUpdateMocks();

			const res = await put(app, {
				openStatus: "OPEN",
				stockStatus: "IN_STOCK",
			});

			expect(res.status).toBe(200);
			expect(mockPrisma.projectPublicInfo.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						openStatus: "NOT_APPLICABLE",
						stockStatus: "NOT_APPLICABLE",
					}),
				})
			);
		});
	});

	describe("不要になったファイルの回収", () => {
		it("差し替えで参照が外れたファイルをソフトデリートする", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks({
				before: { iconFileId: "clffffffffffffffold", mapImages: [] },
				saved: { iconFileId: ICON_FILE_ID },
			});

			const res = await put(app, { iconFileId: ICON_FILE_ID });

			expect(res.status).toBe(200);
			expect(mockPrisma.file.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						id: { in: ["clffffffffffffffold"] },
					}),
				})
			);
		});

		it("他企画から参照されているファイルは削除しない", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks({
				before: { iconFileId: "clffffffffffffffold", mapImages: [] },
				saved: { iconFileId: ICON_FILE_ID },
			});
			mockPrisma.projectPublicInfo.findMany.mockResolvedValue([
				{ iconFileId: "clffffffffffffffold" },
			] as any);

			const res = await put(app, { iconFileId: ICON_FILE_ID });

			expect(res.status).toBe(200);
			expect(mockPrisma.file.updateMany).not.toHaveBeenCalled();
		});

		it("ユーザーのアバターとして使われているファイルは削除しない", async () => {
			// 他人のアバターの fileId を一時的にアイコンへ流用→解除しても、
			// アバターを壊してはいけない（本来は project-public-info のテーブルからしか
			// 参照が外れておらず、softDeleteUnreferencedFiles が他機能を見落とすと壊れる）
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks({
				before: { iconFileId: "clffffffffffffffold", mapImages: [] },
				saved: { iconFileId: ICON_FILE_ID },
			});
			mockPrisma.user.findMany.mockResolvedValue([
				{ avatarFileId: "clffffffffffffffold" },
			] as any);

			const res = await put(app, { iconFileId: ICON_FILE_ID });

			expect(res.status).toBe(200);
			expect(mockPrisma.file.updateMany).not.toHaveBeenCalled();
		});

		it("参照が変わらなければ何も削除しない", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks({
				before: { iconFileId: ICON_FILE_ID, mapImages: [] },
				saved: { iconFileId: ICON_FILE_ID },
			});

			const res = await put(app, { iconFileId: ICON_FILE_ID });

			expect(res.status).toBe(200);
			expect(mockPrisma.file.updateMany).not.toHaveBeenCalled();
		});
	});

	describe("入力値の正規化", () => {
		it("紹介文の空文字は null として保存する", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks();

			const res = await put(app, { description: "" });

			expect(res.status).toBe(200);
			expect(mockPrisma.projectPublicInfo.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({ description: null }),
				})
			);
		});

		it("上限を超える紹介文は400エラー", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks();

			const res = await put(app, {
				description: "あ".repeat(PROJECT_DESCRIPTION_MAX_LENGTH + 1),
			});

			expect(res.status).toBe(400);
		});

		it("ちょうど上限の紹介文は保存できる", async () => {
			const app = makeApp();
			setupAuthAsOwner();
			setupUpdateMocks();

			const res = await put(app, {
				description: "あ".repeat(PROJECT_DESCRIPTION_MAX_LENGTH),
			});

			expect(res.status).toBe(200);
		});
	});
});
