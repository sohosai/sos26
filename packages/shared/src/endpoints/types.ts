import type { z } from "zod";

/**
 * HTTPメソッドの型定義
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

/**
 * APIエンドポイント定義
 * - Method: HTTPメソッド
 * - Path: エンドポイントのパス
 * - PathParams: パスパラメータ（例: /users/:id の :id）のzodスキーマ
 * - Query: クエリパラメータ（例: ?page=1&limit=10）のzodスキーマ
 * - Request: リクエストbodyのzodスキーマ（GETやDELETEの場合はundefined）
 * - Response: レスポンスbodyのzodスキーマ
 *
 * この型により、API仕様を一元管理し、web/apiの両方で同じ定義を参照する
 */
export interface Endpoint<
	Method extends HttpMethod,
	Path extends string,
	PathParams extends z.ZodTypeAny | undefined,
	Query extends z.ZodTypeAny | undefined,
	Request extends z.ZodTypeAny | undefined,
	Response extends z.ZodTypeAny,
> {
	method: Method;
	path: Path;
	pathParams: PathParams;
	query: Query;
	request: Request;
	response: Response;
}

/**
 * GETリクエスト用のエンドポイント定義ヘルパー
 * requestは常にundefinedとなる
 */
export type GetEndpoint<
	Path extends string,
	PathParams extends z.ZodTypeAny | undefined,
	Query extends z.ZodTypeAny | undefined,
	Response extends z.ZodTypeAny,
> = Endpoint<"GET", Path, PathParams, Query, undefined, Response>;

/**
 * bodyを持つリクエスト用のエンドポイント定義ヘルパー
 * POST/PUT/PATCHなどで使用
 */
export type BodyEndpoint<
	Method extends "POST" | "PUT" | "PATCH",
	Path extends string,
	PathParams extends z.ZodTypeAny | undefined,
	Query extends z.ZodTypeAny | undefined,
	Request extends z.ZodTypeAny,
	Response extends z.ZodTypeAny,
> = Endpoint<Method, Path, PathParams, Query, Request, Response>;

/**
 * bodyを持たないリクエスト用のエンドポイント定義ヘルパー
 * DELETE/HEADなどで使用
 */
export type NoBodyEndpoint<
	Method extends "DELETE" | "HEAD",
	Path extends string,
	PathParams extends z.ZodTypeAny | undefined,
	Query extends z.ZodTypeAny | undefined,
	Response extends z.ZodTypeAny,
> = Endpoint<Method, Path, PathParams, Query, undefined, Response>;
