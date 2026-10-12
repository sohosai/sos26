// @ts-nocheck - テストファイルでは res.json() の unknown 型を許容
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma", () => ({
	prisma: {
		project: {
			findMany: vi.fn(),
		},
		mastersheetColumn: {
			findMany: vi.fn(),
		},
		mastersheetCellValue: {
			findMany: vi.fn(),
		},
		file: {
			findFirst: vi.fn(),
		},
	},
}));

vi.mock("../lib/storage/presign", () => ({}));

vi.mock("../lib/storage/image-resize", async importOriginal => ({
	...(await importOriginal()),
	getResizedImage: vi.fn(),
	getOriginalImage: vi.fn(),
}));

vi.mock("../lib/env", () => ({
	env: {
		PUBLIC_API_MASTERSHEET_COLUMN_IDS: [] as string[],
	},
}));

import { env } from "../lib/env";
import { errorHandler } from "../lib/error-handler";
import { prisma } from "../lib/prisma";
import { bumpPublicApiCacheVersion } from "../lib/public-api-cache";
import { getOriginalImage, getResizedImage } from "../lib/storage/image-resize";
import { clearPublicProjectsCache, openApiRoute } from "./openapi";

const mockPrisma = vi.mocked(prisma, true);

const mockRow = {
	id: "clpppppppppppppppp1",
	number: 12,
	name: "焼きそば屋",
	organizationName: "サークルA",
	type: "FOOD",
	location: "OUTDOOR",
	publicInfo: {
		description: "焼きそばを販売します",
		iconFileId: "clfffffffffffffff01",
		openStatus: "OPEN",
		stockStatus: "IN_STOCK",
		websiteUrls: ["https://example.com"],
		xIds: ["sohosai"],
		instagramIds: [],
		youtubeIds: [],
		mapImages: [{ fileId: "clfffffffffffffff02", isHidden: false }],
		moderations: [],
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
		expect(body[0].number).toBe(12);
		expect(body[0].customFields).toEqual({});
		expect(body[0].publicInfo.mapImageFileIds).toEqual(["clfffffffffffffff02"]);
		expect(body[0].publicInfo).toMatchObject({
			websiteUrls: ["https://example.com"],
			xIds: ["sohosai"],
			instagramIds: [],
			youtubeIds: [],
		});
	});

	it("実委人が非表示にした項目は未入力と同じ値で返す", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([
			{
				...mockRow,
				publicInfo: {
					...mockRow.publicInfo,
					mapImages: [
						{ fileId: "clfffffffffffffff02", isHidden: true },
						{ fileId: "clfffffffffffffff03", isHidden: false },
					],
					moderations: [
						{ field: "DESCRIPTION" },
						{ field: "ICON" },
						{ field: "WEBSITE_URLS" },
					],
				},
			},
		] as any);

		const res = await app.request("/openapi/projects");

		const body = await res.json();
		expect(body[0].publicInfo).toEqual({
			description: null,
			iconFileId: null,
			mapImageFileIds: ["clfffffffffffffff03"],
			websiteUrls: [],
			xIds: ["sohosai"],
			instagramIds: [],
			youtubeIds: [],
			openStatus: "OPEN",
			stockStatus: "IN_STOCK",
		});
	});

	it("落選・企画中止・企画辞退と論理削除された企画は取得対象に含めない", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([] as any);

		await app.request("/openapi/projects");

		expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { deletedAt: null, deletionStatus: null },
			})
		);
	});

	it("企画情報が未入力の企画は、基本情報と未入力の値で返す", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([
			{ ...mockRow, publicInfo: null },
		] as any);

		const res = await app.request("/openapi/projects");

		expect(res.status).toBe(200);
		const [project] = await res.json();
		expect(project).toEqual({
			id: mockRow.id,
			number: mockRow.number,
			name: mockRow.name,
			organizationName: mockRow.organizationName,
			type: mockRow.type,
			location: mockRow.location,
			publicInfo: {
				description: null,
				iconFileId: null,
				mapImageFileIds: [],
				websiteUrls: [],
				xIds: [],
				instagramIds: [],
				youtubeIds: [],
				openStatus: "NOT_APPLICABLE",
				stockStatus: "NOT_APPLICABLE",
			},
			customFields: {},
		});
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
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);

		const res = await app.request(`/openapi/projects/${mockRow.id}`);

		expect(res.status).toBe(200);
		expect((await res.json()).id).toBe(mockRow.id);
	});

	it("一覧のキャッシュを共有し、DB に再問い合わせしない", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);

		await app.request("/openapi/projects");
		await app.request(`/openapi/projects/${mockRow.id}`);
		await app.request(`/openapi/projects/${mockRow.id}`);

		expect(mockPrisma.project.findMany).toHaveBeenCalledTimes(1);
	});

	it("見つからない場合は JSON 形式の404を返す", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);

		const res = await app.request("/openapi/projects/not-exist");

		expect(res.status).toBe(404);
		expect(res.headers.get("Content-Type")).toContain("application/json");
		expect((await res.json()).error.code).toBe("NOT_FOUND");
	});
});

describe("GET /openapi/images/{fileId}", () => {
	const iconFileId = mockRow.publicInfo.iconFileId;

	beforeEach(() => {
		vi.clearAllMocks();
		clearPublicProjectsCache();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);
		mockPrisma.file.findFirst.mockResolvedValue({
			key: "user/icon.png",
			mimeType: "image/png",
			size: 1000,
		} as any);
	});

	it("width を指定すると縮小した WebP を返す", async () => {
		const app = makeApp();
		vi.mocked(getResizedImage).mockResolvedValue({
			body: new Uint8Array([1, 2, 3]),
			contentType: "image/webp",
		});

		const res = await app.request(`/openapi/images/${iconFileId}?width=320`);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("image/webp");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("Cache-Control")).toContain("max-age=");
		expect(vi.mocked(getResizedImage)).toHaveBeenCalledWith(
			iconFileId,
			"320",
			expect.any(Function)
		);
	});

	it("width を省略すると元画像を元の Content-Type で返す", async () => {
		const app = makeApp();
		vi.mocked(getOriginalImage).mockResolvedValue({
			body: new Uint8Array([1, 2, 3]),
			contentType: "image/png",
		});

		const res = await app.request("/openapi/images/clfffffffffffffff02");

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("image/png");
		expect(vi.mocked(getOriginalImage)).toHaveBeenCalledWith({
			key: "user/icon.png",
			mimeType: "image/png",
			size: 1000,
		});
	});

	it("width を省略して S3 に元画像がない場合は404を返す", async () => {
		const app = makeApp();
		vi.mocked(getOriginalImage).mockResolvedValue(null);

		const res = await app.request(`/openapi/images/${iconFileId}`);

		expect(res.status).toBe(404);
	});

	it("公開中の企画の画像でなければ404を返し、ファイルを引かない", async () => {
		const app = makeApp();

		const res = await app.request("/openapi/images/other-file?width=320");

		expect(res.status).toBe(404);
		expect((await res.json()).error.code).toBe("NOT_FOUND");
		expect(vi.mocked(getResizedImage)).not.toHaveBeenCalled();
		expect(mockPrisma.file.findFirst).not.toHaveBeenCalled();
	});

	it("元画像が見つからない場合は404を返す", async () => {
		const app = makeApp();
		vi.mocked(getResizedImage).mockResolvedValue(null);

		const res = await app.request(`/openapi/images/${iconFileId}?width=320`);

		expect(res.status).toBe(404);
	});

	it("候補にない width は400を返す", async () => {
		const app = makeApp();

		const res = await app.request(`/openapi/images/${iconFileId}?width=333`);

		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
		expect(vi.mocked(getResizedImage)).not.toHaveBeenCalled();
	});
});

describe("GET /openapi/projects (customFields)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearPublicProjectsCache();
		env.PUBLIC_API_MASTERSHEET_COLUMN_IDS = ["col-stage"];
	});

	afterEach(() => {
		env.PUBLIC_API_MASTERSHEET_COLUMN_IDS = [];
	});

	function cell(columnId: string, value: Partial<Record<string, unknown>>) {
		return {
			columnId,
			projectId: mockRow.id,
			textValue: null,
			numberValue: null,
			selectedOptions: [],
			...value,
		};
	}

	it("環境変数で指定した SELECT 列の選択肢名を列名をキーとして返す", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);
		mockPrisma.mastersheetColumn.findMany.mockResolvedValue([
			{ id: "col-stage", name: "出演ステージ", dataType: "SELECT" },
		] as any);
		mockPrisma.mastersheetCellValue.findMany.mockResolvedValue([
			cell("col-stage", {
				selectedOptions: [{ option: { label: "メインステージ" } }],
			}),
		] as any);

		const res = await app.request("/openapi/projects");

		const body = await res.json();
		expect(body[0].customFields).toEqual({ 出演ステージ: "メインステージ" });
	});

	it("TEXT / NUMBER 列は値をそのまま返し、キーは環境変数の指定順に並ぶ", async () => {
		const app = makeApp();
		env.PUBLIC_API_MASTERSHEET_COLUMN_IDS = ["col-num", "col-text"];
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);
		mockPrisma.mastersheetColumn.findMany.mockResolvedValue([
			{ id: "col-text", name: "キャッチコピー", dataType: "TEXT" },
			{ id: "col-num", name: "定員", dataType: "NUMBER" },
		] as any);
		mockPrisma.mastersheetCellValue.findMany.mockResolvedValue([
			cell("col-text", { textValue: "おいしい" }),
			cell("col-num", { numberValue: 30 }),
		] as any);

		const res = await app.request("/openapi/projects");

		const body = await res.json();
		expect(body[0].customFields).toEqual({
			定員: 30,
			キャッチコピー: "おいしい",
		});
		expect(Object.keys(body[0].customFields)).toEqual([
			"定員",
			"キャッチコピー",
		]);
	});

	it("セル値が未入力の場合は値を null にする", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);
		mockPrisma.mastersheetColumn.findMany.mockResolvedValue([
			{ id: "col-stage", name: "出演ステージ", dataType: "SELECT" },
		] as any);
		mockPrisma.mastersheetCellValue.findMany.mockResolvedValue([] as any);

		const res = await app.request("/openapi/projects");

		const body = await res.json();
		expect(body[0].customFields).toEqual({ 出演ステージ: null });
	});

	it("MULTI_SELECT 列は選択肢名の配列を返し、選択肢の表示順で取得する", async () => {
		const app = makeApp();
		env.PUBLIC_API_MASTERSHEET_COLUMN_IDS = ["col-genre"];
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);
		mockPrisma.mastersheetColumn.findMany.mockResolvedValue([
			{ id: "col-genre", name: "ジャンル", dataType: "MULTI_SELECT" },
		] as any);
		mockPrisma.mastersheetCellValue.findMany.mockResolvedValue([
			cell("col-genre", {
				selectedOptions: [
					{ option: { label: "音楽" } },
					{ option: { label: "ダンス" } },
				],
			}),
		] as any);

		const res = await app.request("/openapi/projects");

		const body = await res.json();
		expect(body[0].customFields).toEqual({ ジャンル: ["音楽", "ダンス"] });
		expect(mockPrisma.mastersheetCellValue.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				select: expect.objectContaining({
					selectedOptions: expect.objectContaining({
						orderBy: { option: { sortOrder: "asc" } },
					}),
				}),
			})
		);
	});

	it("CUSTOM 列のみを対象に列定義を取得する", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);
		mockPrisma.mastersheetColumn.findMany.mockResolvedValue([] as any);

		await app.request("/openapi/projects");

		expect(mockPrisma.mastersheetColumn.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: { in: ["col-stage"] }, type: "CUSTOM" },
			})
		);
	});

	it("指定した列IDがマスターシートに存在しない場合は無視する", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);
		mockPrisma.mastersheetColumn.findMany.mockResolvedValue([] as any);

		const res = await app.request("/openapi/projects");

		const body = await res.json();
		expect(body[0].customFields).toEqual({});
		expect(mockPrisma.mastersheetCellValue.findMany).not.toHaveBeenCalled();
	});

	it("列名が重複する場合は後に指定した列を無視する", async () => {
		const app = makeApp();
		env.PUBLIC_API_MASTERSHEET_COLUMN_IDS = ["col-a", "col-b"];
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);
		mockPrisma.mastersheetColumn.findMany.mockResolvedValue([
			{ id: "col-a", name: "備考", dataType: "TEXT" },
			{ id: "col-b", name: "備考", dataType: "TEXT" },
		] as any);
		mockPrisma.mastersheetCellValue.findMany.mockResolvedValue([
			cell("col-a", { textValue: "A" }),
			cell("col-b", { textValue: "B" }),
		] as any);

		const res = await app.request("/openapi/projects");

		const body = await res.json();
		expect(body[0].customFields).toEqual({ 備考: "A" });
	});

	it("個別取得でも customFields を返す", async () => {
		const app = makeApp();
		mockPrisma.project.findMany.mockResolvedValue([mockRow] as any);
		mockPrisma.mastersheetColumn.findMany.mockResolvedValue([
			{ id: "col-stage", name: "出演ステージ", dataType: "SELECT" },
		] as any);
		mockPrisma.mastersheetCellValue.findMany.mockResolvedValue([
			cell("col-stage", {
				selectedOptions: [{ option: { label: "メインステージ" } }],
			}),
		] as any);

		const res = await app.request(`/openapi/projects/${mockRow.id}`);

		expect((await res.json()).customFields).toEqual({
			出演ステージ: "メインステージ",
		});
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

	it("servers にサブアプリのマウント先（/openapi）を含める", async () => {
		const app = makeApp();

		const res = await app.request("http://localhost:3000/openapi/openapi.json");

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.servers).toEqual([{ url: "http://localhost:3000/openapi" }]);
	});
});
