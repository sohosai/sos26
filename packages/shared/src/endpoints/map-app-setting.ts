import {
	getMapAppSettingResponseSchema,
	updateMapAppSettingRequestSchema,
	updateMapAppSettingResponseSchema,
} from "../schemas/map-app-setting";
import type { BodyEndpoint, GetEndpoint } from "./types";

export const getMapAppSettingEndpoint: GetEndpoint<
	"/committee/map-settings",
	undefined,
	undefined,
	typeof getMapAppSettingResponseSchema
> = {
	method: "GET",
	path: "/committee/map-settings",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: getMapAppSettingResponseSchema,
} as const;

export const updateMapAppSettingEndpoint: BodyEndpoint<
	"PUT",
	"/committee/map-settings",
	undefined,
	undefined,
	typeof updateMapAppSettingRequestSchema,
	typeof updateMapAppSettingResponseSchema
> = {
	method: "PUT",
	path: "/committee/map-settings",
	pathParams: undefined,
	query: undefined,
	request: updateMapAppSettingRequestSchema,
	response: updateMapAppSettingResponseSchema,
} as const;
