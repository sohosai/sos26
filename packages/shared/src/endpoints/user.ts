import {
	searchUsersQuerySchema,
	searchUsersResponseSchema,
} from "../schemas/user";
import type { GetEndpoint } from "./types";

/**
 * GET /committee/users/search
 * ユーザーを名前・メールアドレス・読み仮名で曖昧検索
 *
 * - 認証 + 実委メンバー必須
 * - search パラメータで部分一致検索（大文字小文字無視）
 * - limit で最大取得件数を指定（デフォルト: 10）
 */
export const searchUsersEndpoint: GetEndpoint<
	"/committee/users/search",
	undefined,
	typeof searchUsersQuerySchema,
	typeof searchUsersResponseSchema
> = {
	method: "GET",
	path: "/committee/users/search",
	pathParams: undefined,
	query: searchUsersQuerySchema,
	request: undefined,
	response: searchUsersResponseSchema,
} as const;
