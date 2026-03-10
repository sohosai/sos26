import type {
	GetUserSettingsResponse,
	UpdateUserSettingsRequest,
	UpdateUserSettingsResponse,
} from "@sos26/shared";
import {
	getUserSettingsEndpoint,
	updateUserSettingsEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi } from "./core";

/**
 * ユーザー設定を取得する
 */
export async function getUserSettings(): Promise<GetUserSettingsResponse> {
	return callGetApi(getUserSettingsEndpoint);
}

/**
 * ユーザー設定を更新する
 */
export async function updateUserSettings(
	data: UpdateUserSettingsRequest
): Promise<UpdateUserSettingsResponse> {
	return callBodyApi(updateUserSettingsEndpoint, data);
}
