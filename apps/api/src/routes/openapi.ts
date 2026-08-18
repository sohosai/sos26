import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
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
 * 公開情報（ProjectPublicInfo）を作成した企画だけを対象にする。
 * 企画側が「企画情報」画面で保存して初めてレコードが作られるため、
 * これがオンラインマップ掲載のオプトインとして機能する。
 */
const publicProjectWhere = {
	deletedAt: null,
	deletionStatus: null,
	publicInfo: { isNot: null },
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
			openStatus: true,
			stockStatus: true,
			mapImages: {
				orderBy: { sortOrder: "asc" },
				select: { fileId: true },
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
		openStatus: PublicProject["publicInfo"]["openStatus"];
		stockStatus: PublicProject["publicInfo"]["stockStatus"];
		mapImages: { fileId: string }[];
	} | null;
};

/** publicInfo が null の行は publicProjectWhere で除外済みのため取り除く */
function toPublicProject(row: PublicProjectRow): PublicProject | null {
	if (!row.publicInfo) return null;

	return {
		id: row.id,
		name: row.name,
		organizationName: row.organizationName,
		type: row.type,
		location: row.location,
		publicInfo: {
			description: row.publicInfo.description,
			iconFileId: row.publicInfo.iconFileId,
			mapImageFileIds: row.publicInfo.mapImages.map(img => img.fileId),
			openStatus: row.publicInfo.openStatus,
			stockStatus: row.publicInfo.stockStatus,
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

	const value = rows
		.map(toPublicProject)
		.filter((p): p is PublicProject => p !== null);
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
