import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { ProjectPublicInfoField } from "@sos26/shared";
import { projectPublicInfoSchema } from "@sos26/shared";
import { prisma } from "../lib/prisma";
import { getPublicApiCacheVersion } from "../lib/public-api-cache";

export const openApiRoute = new OpenAPIHono();

/**
 * 一覧レスポンスのキャッシュ保持時間（ミリ秒）
 *
 * 無認証で誰でも叩けるエンドポイントのため、DBへの負荷が
 * リクエスト数に比例しないようプロセス内でキャッシュする。
 */
const LIST_CACHE_TTL_MS = 60_000;
const CACHE_CONTROL = `public, max-age=${LIST_CACHE_TTL_MS / 1000}`;

const publicProjectSchema = z.object({
	id: z.string(),
	name: z.string(),
	organizationName: z.string(),
	type: z.enum(["STAGE", "FOOD", "NORMAL"]),
	location: z.enum(["INDOOR", "OUTDOOR", "STAGE"]),
	publicInfo: projectPublicInfoSchema,
});

type PublicProject = z.infer<typeof publicProjectSchema>;

const publicProjectListResponseSchema = z.array(publicProjectSchema);

const errorResponseSchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
});

/**
 * 公開対象の企画の絞り込み条件
 *
 * 有効な企画をすべて対象にする。落選・企画中止・企画辞退の企画は含めない。
 */
const publicProjectWhere = {
	deletedAt: null,
	deletionStatus: null,
} as const;

const publicProjectSelect = {
	id: true,
	name: true,
	organizationName: true,
	type: true,
	location: true,
	publicInfo: {
		select: {
			description: true,
			iconFileId: true,
			websiteUrls: true,
			xIds: true,
			instagramIds: true,
			youtubeIds: true,
			openStatus: true,
			stockStatus: true,
			mapImages: {
				orderBy: { sortOrder: "asc" },
				select: { fileId: true, isHidden: true },
			},
			moderations: {
				where: { kind: "HIDDEN" },
				select: { field: true },
			},
		},
	},
} as const;

type PublicProjectRow = {
	id: string;
	name: string;
	organizationName: string;
	type: PublicProject["type"];
	location: PublicProject["location"];
	publicInfo: {
		description: string | null;
		iconFileId: string | null;
		websiteUrls: string[];
		xIds: string[];
		instagramIds: string[];
		youtubeIds: string[];
		openStatus: PublicProject["publicInfo"]["openStatus"];
		stockStatus: PublicProject["publicInfo"]["stockStatus"];
		mapImages: { fileId: string; isHidden: boolean }[];
		moderations: { field: ProjectPublicInfoField }[];
	} | null;
};

/** 企画情報が未入力の企画に返す値 */
const EMPTY_PUBLIC_INFO: PublicProject["publicInfo"] = {
	description: null,
	iconFileId: null,
	mapImageFileIds: [],
	websiteUrls: [],
	xIds: [],
	instagramIds: [],
	youtubeIds: [],
	openStatus: "NOT_APPLICABLE",
	stockStatus: "NOT_APPLICABLE",
};

/**
 * 企画情報が未入力の企画は、すべての項目を未入力の値で返す。
 *
 * 実委人が非表示にした項目も未入力と同じ値にする。
 * 非表示にされたのか未入力なのかを、公開APIの利用者から区別できないようにするため。
 */
function toPublicProject(row: PublicProjectRow): PublicProject {
	const project = {
		id: row.id,
		name: row.name,
		organizationName: row.organizationName,
		type: row.type,
		location: row.location,
	};
	const info = row.publicInfo;
	if (!info) return { ...project, publicInfo: EMPTY_PUBLIC_INFO };

	const hidden = new Set(info.moderations.map(m => m.field));

	return {
		...project,
		publicInfo: {
			description: hidden.has("DESCRIPTION") ? null : info.description,
			iconFileId: hidden.has("ICON") ? null : info.iconFileId,
			mapImageFileIds: info.mapImages
				.filter(img => !img.isHidden)
				.map(img => img.fileId),
			websiteUrls: hidden.has("WEBSITE_URLS") ? [] : info.websiteUrls,
			xIds: hidden.has("X_IDS") ? [] : info.xIds,
			instagramIds: hidden.has("INSTAGRAM_IDS") ? [] : info.instagramIds,
			youtubeIds: hidden.has("YOUTUBE_IDS") ? [] : info.youtubeIds,
			openStatus: info.openStatus,
			stockStatus: info.stockStatus,
		},
	};
}

let listCache: {
	expiresAt: number;
	version: number;
	value: PublicProject[];
} | null = null;

async function getPublicProjects(): Promise<PublicProject[]> {
	const now = Date.now();
	const version = getPublicApiCacheVersion();
	if (listCache && listCache.expiresAt > now && listCache.version === version) {
		return listCache.value;
	}

	const rows = await prisma.project.findMany({
		where: publicProjectWhere,
		select: publicProjectSelect,
		orderBy: { number: "asc" },
	});

	const value = rows.map(toPublicProject);
	listCache = { expiresAt: now + LIST_CACHE_TTL_MS, version, value };
	return value;
}

/** テスト用にキャッシュを破棄する */
export function clearPublicProjectsCache(): void {
	listCache = null;
}

const getProjectsRoute = createRoute({
	method: "get",
	path: "/projects",
	responses: {
		200: {
			content: {
				"application/json": {
					schema: publicProjectListResponseSchema,
				},
			},
			description: "企画の情報（一覧）",
		},
	},
});

openApiRoute.openapi(getProjectsRoute, async c => {
	const response = await getPublicProjects();

	c.header("Cache-Control", CACHE_CONTROL);
	return c.json(response, 200);
});

const getProjectDetailRoute = createRoute({
	method: "get",
	path: "/projects/{id}",
	request: {
		params: z.object({
			id: z.string().openapi({ param: { name: "id", in: "path" } }),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: publicProjectSchema,
				},
			},
			description: "企画の情報（個別）",
		},
		404: {
			content: {
				"application/json": {
					schema: errorResponseSchema,
				},
			},
			description: "企画が見つからない、または未公開",
		},
	},
});

openApiRoute.openapi(getProjectDetailRoute, async c => {
	const id = c.req.valid("param").id;
	const row = await prisma.project.findFirst({
		where: { ...publicProjectWhere, id },
		select: publicProjectSelect,
	});

	const response = row ? toPublicProject(row) : null;

	if (!response) {
		return c.json(
			{
				error: {
					code: "NOT_FOUND",
					message: "企画が見つかりません",
				},
			},
			404
		);
	}

	c.header("Cache-Control", CACHE_CONTROL);
	return c.json(response, 200);
});

openApiRoute.doc("/openapi.json", c => ({
	openapi: "3.0.0",
	info: {
		title: "sos26 Public API",
		version: "1.0.0",
		description:
			"雙峰祭オンラインマップにデータ連携をするためのAPI。認証不要で、企画側が公開情報を登録した企画のみを返す。",
	},
	// createRoute のパスはこのサブアプリ内の相対パス（例: /projects）で
	// spec に出力される。servers を明示しないと Swagger UI の Try it out や
	// クライアント生成がオリジン直下（/projects）を叩いて404になるため、
	// 実際のマウント先（/openapi）をリクエストから動的に組み立てる
	servers: [{ url: `${new URL(c.req.url).origin}/openapi` }],
}));

openApiRoute.get("/swagger", swaggerUI({ url: "/openapi/openapi.json" }));
