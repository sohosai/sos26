import type {
	GetProjectPublicInfoResponse,
	UpdateProjectPublicInfoRequest,
	UpdateProjectPublicInfoResponse,
} from "@sos26/shared";
import {
	getProjectPublicInfoEndpoint,
	updateProjectPublicInfoEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi } from "./core";

export async function getProjectPublicInfo(
	projectId: string
): Promise<GetProjectPublicInfoResponse> {
	return callGetApi(getProjectPublicInfoEndpoint, {
		pathParams: { projectId },
	});
}

export async function updateProjectPublicInfo(
	projectId: string,
	data: UpdateProjectPublicInfoRequest
): Promise<UpdateProjectPublicInfoResponse> {
	return callBodyApi(updateProjectPublicInfoEndpoint, data, {
		pathParams: { projectId },
	});
}
