import {
	type AddProjectRegistrationFormCollaboratorRequest,
	type AddProjectRegistrationFormCollaboratorResponse,
	addProjectRegistrationFormCollaboratorEndpoint,
	type CreateProjectRegistrationFormRequest,
	type CreateProjectRegistrationFormResponse,
	createProjectRegistrationFormEndpoint,
	type DeleteProjectRegistrationFormResponse,
	deleteProjectRegistrationFormEndpoint,
	type GetProjectRegistrationFormDetailResponse,
	getProjectRegistrationFormDetailEndpoint,
	type ListProjectRegistrationFormResponsesResponse,
	type ListProjectRegistrationFormsResponse,
	listProjectRegistrationFormResponsesEndpoint,
	listProjectRegistrationFormsEndpoint,
	type RemoveProjectRegistrationFormCollaboratorResponse,
	type RequestProjectRegistrationFormAuthorizationRequest,
	type RequestProjectRegistrationFormAuthorizationResponse,
	removeProjectRegistrationFormCollaboratorEndpoint,
	requestProjectRegistrationFormAuthorizationEndpoint,
	type UpdateProjectRegistrationFormAuthorizationRequest,
	type UpdateProjectRegistrationFormAuthorizationResponse,
	type UpdateProjectRegistrationFormRequest,
	type UpdateProjectRegistrationFormResponse,
	updateProjectRegistrationFormAuthorizationEndpoint,
	updateProjectRegistrationFormEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi, callNoBodyApi } from "./core";

/**
 * POST /committee/project-registration-forms/create
 * 企画登録フォームを作成
 */
export async function createProjectRegistrationForm(
	body: CreateProjectRegistrationFormRequest
): Promise<CreateProjectRegistrationFormResponse> {
	return callBodyApi(createProjectRegistrationFormEndpoint, body);
}

/**
 * GET /committee/project-registration-forms
 * 企画登録フォーム一覧を取得
 */
export async function listProjectRegistrationForms(): Promise<ListProjectRegistrationFormsResponse> {
	return callGetApi(listProjectRegistrationFormsEndpoint);
}

/**
 * GET /committee/project-registration-forms/:formId
 * 企画登録フォーム詳細を取得
 */
export async function getProjectRegistrationFormDetail(
	formId: string
): Promise<GetProjectRegistrationFormDetailResponse> {
	return callGetApi(getProjectRegistrationFormDetailEndpoint, {
		pathParams: { formId },
	});
}

/**
 * PATCH /committee/project-registration-forms/:formId
 * 企画登録フォームを更新
 */
export async function updateProjectRegistrationForm(
	formId: string,
	body: UpdateProjectRegistrationFormRequest
): Promise<UpdateProjectRegistrationFormResponse> {
	return callBodyApi(updateProjectRegistrationFormEndpoint, body, {
		pathParams: { formId },
	});
}

/**
 * DELETE /committee/project-registration-forms/:formId
 * 企画登録フォームを論理削除
 */
export async function deleteProjectRegistrationForm(
	formId: string
): Promise<DeleteProjectRegistrationFormResponse> {
	return callNoBodyApi(deleteProjectRegistrationFormEndpoint, {
		pathParams: { formId },
	});
}

/**
 * POST /committee/project-registration-forms/:formId/authorizations
 * 承認申請
 */
export async function requestProjectRegistrationFormAuthorization(
	formId: string,
	body: RequestProjectRegistrationFormAuthorizationRequest
): Promise<RequestProjectRegistrationFormAuthorizationResponse> {
	return callBodyApi(
		requestProjectRegistrationFormAuthorizationEndpoint,
		body,
		{ pathParams: { formId } }
	);
}

/**
 * PATCH /committee/project-registration-forms/:formId/authorizations/:authorizationId
 * 承認・却下
 */
export async function updateProjectRegistrationFormAuthorization(
	formId: string,
	authorizationId: string,
	body: UpdateProjectRegistrationFormAuthorizationRequest
): Promise<UpdateProjectRegistrationFormAuthorizationResponse> {
	return callBodyApi(updateProjectRegistrationFormAuthorizationEndpoint, body, {
		pathParams: { formId, authorizationId },
	});
}

/**
 * POST /committee/project-registration-forms/:formId/collaborators/:userId
 * 共同編集者を追加
 */
export async function addProjectRegistrationFormCollaborator(
	formId: string,
	userId: string,
	body: AddProjectRegistrationFormCollaboratorRequest
): Promise<AddProjectRegistrationFormCollaboratorResponse> {
	return callBodyApi(addProjectRegistrationFormCollaboratorEndpoint, body, {
		pathParams: { formId, userId },
	});
}

/**
 * DELETE /committee/project-registration-forms/:formId/collaborators/:userId
 * 共同編集者を削除
 */
export async function removeProjectRegistrationFormCollaborator(
	formId: string,
	userId: string
): Promise<RemoveProjectRegistrationFormCollaboratorResponse> {
	return callNoBodyApi(removeProjectRegistrationFormCollaboratorEndpoint, {
		pathParams: { formId, userId },
	});
}

/**
 * GET /committee/project-registration-forms/:formId/responses
 * 企画登録フォームへの回答一覧
 */
export async function listProjectRegistrationFormResponses(
	formId: string
): Promise<ListProjectRegistrationFormResponsesResponse> {
	return callGetApi(listProjectRegistrationFormResponsesEndpoint, {
		pathParams: { formId },
	});
}
