import {
	type CreateFormResponseRequest,
	type CreateFormResponseResponse,
	createFormResponseEndpoint,
	type GetProjectFormResponse,
	getProjectFormEndpoint,
	type ListProjectFormsResponse,
	listProjectFormsEndpoint,
	type UpdateFormResponseRequest,
	type UpdateFormResponseResponse,
	updateFormResponseEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi } from "./core";

export async function listProjectForms(
	projectId: string
): Promise<ListProjectFormsResponse> {
	return callGetApi(listProjectFormsEndpoint, { pathParams: { projectId } });
}

export async function getProjectForm(
	projectId: string,
	formDeliveryId: string
): Promise<GetProjectFormResponse> {
	return callGetApi(getProjectFormEndpoint, {
		pathParams: { projectId, formDeliveryId },
	});
}

export async function createFormResponse(
	projectId: string,
	formDeliveryId: string,
	body: CreateFormResponseRequest
): Promise<CreateFormResponseResponse> {
	return callBodyApi(createFormResponseEndpoint, body, {
		pathParams: { projectId, formDeliveryId },
	});
}

export async function updateFormResponse(
	projectId: string,
	formDeliveryId: string,
	responseId: string,
	body: UpdateFormResponseRequest
): Promise<UpdateFormResponseResponse> {
	return callBodyApi(updateFormResponseEndpoint, body, {
		pathParams: { projectId, formDeliveryId, responseId },
	});
}
