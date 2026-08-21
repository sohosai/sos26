import type {
	GetMapAppSettingResponse,
	UpdateMapAppSettingRequest,
	UpdateMapAppSettingResponse,
} from "@sos26/shared";
import {
	getMapAppSettingEndpoint,
	updateMapAppSettingEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi } from "./core";

export async function getMapAppSetting(): Promise<GetMapAppSettingResponse> {
	return callGetApi(getMapAppSettingEndpoint);
}

export async function updateMapAppSetting(
	data: UpdateMapAppSettingRequest
): Promise<UpdateMapAppSettingResponse> {
	return callBodyApi(updateMapAppSettingEndpoint, data);
}
