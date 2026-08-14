// @ts-nocheck - テストファイルでは res.json() の unknown 型を許容
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma", () => ({
	prisma: {
		project: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
		},
	},
}));

import { errorHandler } from "../lib/error-handler";
import { prisma } from "../lib/prisma";
import { bumpPublicApiCacheVersion } from "../lib/public-api-cache";
import { clearPublicProjectsCache, openApiRoute } from "./openapi";

const mockPrisma = vi.mocked(prisma, true);

const mockRow = {
	id: "clpppppppppppppppp1",
	name: "焼きそば屋",
	organizationName: "サークルA",
	type: "FOOD",
	location: "OUTDOOR",
	publicInfo: {
		description: "焼きそばを販売します",
		iconFileId: "clfffffffffffffff01",
		openStatus: "OPEN",
		stockStatus: "IN_STOCK",
		mapImages: [{ fileId: "clfffffffffffffff02" }],
	},
};

function makeApp() {
	const app = new Hono();
	app.onError(errorHandler);
	app.route("/openapi", openApiRoute);
	return app;
}

describe("GET /openapi/projects", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearPublicProjectsCache();
	});

	it("正常系: 認証なしで企画一覧を取得できる", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);

		const res = await app.request("/openapi/projects");

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toHaveLength(1);
		expect(body[0].publicInfo.mapImageFileIds).toEqual(["clfffffffffffffff02"]);
	});

	it("公開情報を登録していない企画は取得対象に含めない", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([] as any);

		await app.request("/openapi/projects");

		expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					deletedAt: null,
					deletionStatus: null,
					publicInfo: { isNot: null },
				}),
			})
		);
	});

	it("キャッシュが有効な間は DB に再問い合わせしない", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);

		await app.request("/openapi/projects");
		await app.request("/openapi/projects");

		expect(mockPrisma.project.findMany).toHaveBeenCalledTimes(1);
	});

	it("公開情報が更新されたらキャッシュを破棄して取り直す", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);

		await app.request("/openapi/projects");
		bumpPublicApiCacheVersion();
		await app.request("/openapi/projects");

		expect(mockPrisma.project.findMany).toHaveBeenCalledTimes(2);
	});

	it("キャッシュ制御ヘッダを返す", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);

		const res = await app.request("/openapi/projects");

		expect(res.headers.get("Cache-Control")).toContain("max-age=");
	});
});

describe("GET /openapi/projects/{id}", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearPublicProjectsCache();
	});

	it("正常系: 個別の企画を取得できる", async () => {
		const app = makeApp();
		mockPrisma.project.findFirst.mockResolvedValue(mockRow as any);

		const res = await app.request(`/openapi/projects/${mockRow.id}`);

		expect(res.status).toBe(200);
		expect((await res.json()).id).toBe(mockRow.id);
	});

	it("見つからない場合は JSON 形式の404を返す", async () => {
		const app = makeApp();
		mockPrisma.project.findFirst.mockResolvedValue(null);

		const res = await app.request("/openapi/projects/not-exist");

		expect(res.status).toBe(404);
		expect(res.headers.get("Content-Type")).toContain("application/json");
		expect((await res.json()).error.code).toBe("NOT_FOUND");
	});
});

describe("GET /openapi/openapi.json", () => {
	it("OpenAPI ドキュメントを返す", async () => {
		const app = makeApp();

		const res = await app.request("/openapi/openapi.json");

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.paths["/projects"]).toBeDefined();
		expect(body.paths["/projects/{id}"]).toBeDefined();
	});
});
