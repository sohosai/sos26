import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
	type MastersheetDataType,
	projectPublicInfoSchema,
} from "@sos26/shared";
import { env } from "../lib/env";
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

const customFieldSchema = z.object({
	name: z.string().openapi({ description: "マスターシートの列名" }),
	value: z
		.union([z.string(), z.number(), z.array(z.string()), z.null()])
		.openapi({
			description:
				"列の値。データ型により形式が異なる: " +
				"TEXTは文字列、NUMBERは数値、SELECTは選択された選択肢名（文字列）、" +
				"MULTI_SELECTは選択された選択肢名の配列。未入力の場合は null",
		}),
});

type CustomField = z.infer<typeof customFieldSchema>;

const publicProjectSchema = z.object({
	id: z.string(),
	number: z.number().openapi({ description: "企画番号" }),
	name: z.string(),
	organizationName: z.string(),
	type: z.enum(["STAGE", "FOOD", "NORMAL"]),
	location: z.enum(["INDOOR", "OUTDOOR", "STAGE"]),
	publicInfo: projectPublicInfoSchema,
	customFields: z.array(customFieldSchema).openapi({
		description:
			"実委が公開対象に指定したマスターシートの列（環境変数 " +
			"PUBLIC_API_MASTERSHEET_COLUMN_IDS で指定した列）の値。" +
			"指定がない場合は空配列",
	}),
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
	number: true,
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
	number: number;
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
function toPublicProject(
	row: PublicProjectRow,
	customFields: CustomField[]
): PublicProject | null {
	if (!row.publicInfo) return null;

	return {
		id: row.id,
		number: row.number,
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
		customFields,
	};
}

// ─────────────────────────────────────────────────────────────
// customFields: マスターシートの公開対象列
// ─────────────────────────────────────────────────────────────

type PublicCustomColumn = {
	id: string;
	name: string;
	dataType: MastersheetDataType;
};

/**
 * PUBLIC_API_MASTERSHEET_COLUMN_IDS で指定された列の定義を解決する。
 *
 * - 存在しない列ID、CUSTOM以外の列（FORM_ITEM / PROJECT_REGISTRATION_FORM_ITEM）は
 *   対象外として警告ログを出しスキップする（公開APIは落とさない）。
 * - 環境変数の指定順を維持する。
 */
async function resolvePublicCustomColumns(): Promise<PublicCustomColumn[]> {
	const ids = env.PUBLIC_API_MASTERSHEET_COLUMN_IDS;
	if (ids.length === 0) return [];

	const columns = await prisma.mastersheetColumn.findMany({
		where: { id: { in: ids }, type: "CUSTOM" },
		select: { id: true, name: true, dataType: true },
	});
	const byId = new Map(columns.map(c => [c.id, c]));

	const resolved: PublicCustomColumn[] = [];
	for (const id of ids) {
		const col = byId.get(id);
		if (!col?.dataType) {
			console.warn(
				`[openapi] PUBLIC_API_MASTERSHEET_COLUMN_IDS の列が見つからないか CUSTOM 列ではありません: ${id}`
			);
			continue;
		}
		resolved.push({ id: col.id, name: col.name, dataType: col.dataType });
	}
	return resolved;
}

type PublicCustomCell = {
	textValue: string | null;
	numberValue: number | null;
	selectedOptions: { option: { label: string } }[];
};

function formatCustomFieldValue(
	dataType: MastersheetDataType,
	cell: PublicCustomCell | undefined
): CustomField["value"] {
	if (!cell) return null;

	switch (dataType) {
		case "TEXT":
			return cell.textValue;
		case "NUMBER":
			return cell.numberValue;
		case "SELECT":
			return cell.selectedOptions[0]?.option.label ?? null;
		case "MULTI_SELECT":
			return cell.selectedOptions.map(s => s.option.label);
	}
}

/** 企画IDごとの customFields を一括取得する */
async function getCustomFieldsByProject(
	projectIds: string[]
): Promise<Map<string, CustomField[]>> {
	const map = new Map<string, CustomField[]>();
	const columns = await resolvePublicCustomColumns();

	if (columns.length === 0 || projectIds.length === 0) {
		for (const id of projectIds) map.set(id, []);
		return map;
	}

	const cells = await prisma.mastersheetCellValue.findMany({
		where: {
			columnId: { in: columns.map(c => c.id) },
			projectId: { in: projectIds },
		},
		select: {
			columnId: true,
			projectId: true,
			textValue: true,
			numberValue: true,
			selectedOptions: { select: { option: { select: { label: true } } } },
		},
	});

	const cellByColProject = new Map<string, Map<string, PublicCustomCell>>();
	for (const cell of cells) {
		if (!cellByColProject.has(cell.columnId))
			cellByColProject.set(cell.columnId, new Map());
		cellByColProject.get(cell.columnId)?.set(cell.projectId, cell);
	}

	for (const projectId of projectIds) {
		map.set(
			projectId,
			columns.map(col => ({
				name: col.name,
				value: formatCustomFieldValue(
					col.dataType,
					cellByColProject.get(col.id)?.get(projectId)
				),
			}))
		);
	}
	return map;
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

	const customFieldsByProject = await getCustomFieldsByProject(
		rows.map(r => r.id)
	);

	const value = rows
		.map(row => toPublicProject(row, customFieldsByProject.get(row.id) ?? []))
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

	const customFields = row
		? ((await getCustomFieldsByProject([row.id])).get(row.id) ?? [])
		: [];
	const response = row ? toPublicProject(row, customFields) : null;

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
