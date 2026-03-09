import {
	getUserSettingsResponseSchema,
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
