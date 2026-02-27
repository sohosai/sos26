import type { Endpoint } from "@sos26/shared";
import type { Options } from "ky";
import type { z } from "zod";
import { httpClient } from "../http/client";
import { throwClientError } from "../http/error";

/** 正規表現の特殊文字をエスケープ */
function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** pathパラメータをURLエンコードして安全に置換 */
function replacePathParams(
	path: string,
	params: Record<string, string | number>
): string {
	return Object.entries(params).reduce(
		(acc, [key, value]) =>
			acc.replace(
				new RegExp(`:${escapeRegExp(key)}(?=/|$)`, "g"),
				encodeURIComponent(String(value))
			),
		path
	);
}

/** kyのprefixUrlと連結できるよう先頭スラッシュを除去 */
function normalizePath(path: string): string {
	return path.replace(/^\/+/, "");
}

/** path・queryを検証し、置換/整形して返す */
function preparePathAndQuery<
	PathParams extends z.ZodTypeAny | undefined,
	Query extends z.ZodTypeAny | undefined,
>(
	endpoint: {
		path: string;
		pathParams: PathParams;
		query: Query;
	},
	params?: {
		pathParams?: PathParams extends z.ZodTypeAny ? z.infer<PathParams> : never;
		query?: Query extends z.ZodTypeAny ? z.infer<Query> : never;
	}
): {
	path: string;
	searchParams?: Options["searchParams"] | undefined;
} {
	let path = endpoint.path;

	// pathパラメータを検証して置換
	if (endpoint.pathParams && params?.pathParams) {
		// replacePathParams関数がRecord<string, string | number>を期待するため、ここのみ型アサーション
		const validatedPathParams = endpoint.pathParams.parse(
			params.pathParams
		) as Record<string, string | number>;
		path = replacePathParams(path, validatedPathParams);
	}

	// queryパラメータを検証
	let searchParams: Options["searchParams"] | undefined;
	if (endpoint.query && params?.query) {
		searchParams = endpoint.query.parse(
			params.query
		) as Options["searchParams"];
	}

	// kyのprefixUrlと併用するため先頭スラッシュを除去
	const normalizedPath = normalizePath(path);
	return { path: normalizedPath, searchParams };
}

/**
 * GET用の共通API caller
 *
 * 成功時: DataSchema.parse(data) を返す
 * 失敗時: ClientError を throw
 */
export async function callGetApi<
	PathParams extends z.ZodTypeAny | undefined,
	Query extends z.ZodTypeAny | undefined,
	Response extends z.ZodTypeAny,
>(
	endpoint: Endpoint<"GET", string, PathParams, Query, undefined, Response>,
	params?: {
		pathParams?: PathParams extends z.ZodTypeAny ? z.infer<PathParams> : never;
		query?: Query extends z.ZodTypeAny ? z.infer<Query> : never;
	}
): Promise<z.infer<Response>> {
	const { path, searchParams } = preparePathAndQuery(endpoint, params);

	try {
		const response = await httpClient
			.get(path, {
				searchParams,
			})
			.json();

		// レスポンスを実行時検証
		return endpoint.response.parse(response);
	} catch (error) {
		return throwClientError(error);
	}
}

/**
 * bodyありメソッド用の共通API caller
 *
 * 成功時: DataSchema.parse(data) を返す
 * 失敗時: ClientError を throw
 */
export async function callBodyApi<
	Method extends "POST" | "PUT" | "PATCH",
	PathParams extends z.ZodTypeAny | undefined,
	Query extends z.ZodTypeAny | undefined,
	Request extends z.ZodTypeAny,
	Response extends z.ZodTypeAny,
>(
	endpoint: Endpoint<Method, string, PathParams, Query, Request, Response>,
	body: z.infer<Request>,
	params?: {
		pathParams?: PathParams extends z.ZodTypeAny ? z.infer<PathParams> : never;
		query?: Query extends z.ZodTypeAny ? z.infer<Query> : never;
	}
): Promise<z.infer<Response>> {
	const { path, searchParams } = preparePathAndQuery(endpoint, params);

	try {
		// リクエストbodyを実行時検証
		const validatedBody = endpoint.request.parse(body);

		const response = await httpClient(path, {
			method: endpoint.method,
			json: validatedBody,
			searchParams,
		}).json();

		// レスポンスを実行時検証
		return endpoint.response.parse(response);
	} catch (error) {
		return throwClientError(error);
	}
}

/**
 * bodyなしメソッド（DELETE/HEAD）用 caller
 *
 * 成功時: DataSchema.parse(data) を返す
 * 失敗時: ClientError を throw
 */
export async function callNoBodyApi<
	Method extends "POST" | "PATCH" | "DELETE" | "HEAD",
	PathParams extends z.ZodTypeAny | undefined,
	Query extends z.ZodTypeAny | undefined,
	Response extends z.ZodTypeAny,
>(
	endpoint: Endpoint<Method, string, PathParams, Query, undefined, Response>,
	params?: {
		pathParams?: PathParams extends z.ZodTypeAny ? z.infer<PathParams> : never;
		query?: Query extends z.ZodTypeAny ? z.infer<Query> : never;
	}
): Promise<z.infer<Response>> {
	const { path, searchParams } = preparePathAndQuery(endpoint, params);

	try {
		const response = await httpClient(path, {
			method: endpoint.method,
			searchParams,
		}).json();

		// レスポンスを実行時検証
		return endpoint.response.parse(response);
	} catch (error) {
		return throwClientError(error);
	}
}
