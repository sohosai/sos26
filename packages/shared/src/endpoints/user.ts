import {
	getUserSettingsResponseSchema,
	searchUsersQuerySchema,
	searchUsersResponseSchema,
	updateUserSettingsRequestSchema,
	updateUserSettingsResponseSchema,
} from "../schemas/user";
import type { BodyEndpoint, GetEndpoint } from "./types";

/**
 * GET /user/settings
 * 現在のユーザーの設定を取得
 *
 * - 認証必須
 */
export const getUserSettingsEndpoint: GetEndpoint<
	"/user/settings",
	undefined,
	undefined,
	typeof getUserSettingsResponseSchema
> = {
	method: "GET",
	path: "/user/settings",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: getUserSettingsResponseSchema,
} as const;

/**
 * PATCH /user/settings
 * 現在のユーザーの設定を更新
 *
 * - 認証必須
 * - avatarFileId, sendKey を部分更新
 */
export const updateUserSettingsEndpoint: BodyEndpoint<
	"PATCH",
	"/user/settings",
	undefined,
	undefined,
	typeof updateUserSettingsRequestSchema,
	typeof updateUserSettingsResponseSchema
> = {
	method: "PATCH",
	path: "/user/settings",
	pathParams: undefined,
	query: undefined,
	request: updateUserSettingsRequestSchema,
	response: updateUserSettingsResponseSchema,
} as const;

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
