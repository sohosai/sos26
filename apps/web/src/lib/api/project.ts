import {
	type AssignSubOwnerResponse,
	approveSubOwnerRequestEndpoint,
	assignSubOwnerEndpoint,
	type CreateProjectRegistrationFormResponseRequest,
	type CreateProjectRegistrationFormResponseResponse,
	type CreateProjectRequest,
	type CreateProjectResponse,
	cancelSubOwnerRequestEndpoint,
	createProjectEndpoint,
	createProjectRegistrationFormResponseEndpoint,
	type DecideSubOwnerRequestResponse,
	type GetApplicationPeriodResponse,
	type GetProjectDetailResponse,
	type GetProjectRegistrationFormResponsesResponse,
	getApplicationPeriodEndpoint,
	getProjectDetailEndpoint,
	getProjectRegistrationFormResponsesEndpoint,
	type JoinProjectRequest,
	type JoinProjectResponse,
	joinProjectEndpoint,
	type ListMyProjectsResponse,
	type ListProjectMembersResponse,
	listMyProjectsEndpoint,
	listProjectMembersEndpoint,
	type RegenerateInviteCodeResponse,
	type RemoveProjectMemberResponse,
	regenerateInviteCodeEndpoint,
	rejectSubOwnerRequestEndpoint,
	removeProjectMemberEndpoint,
	type UpdateProjectDetailRequest,
	type UpdateProjectDetailResponse,
	type UpdateProjectRegistrationFormResponseRequest,
	type UpdateProjectRegistrationFormResponseResponse,
	updateProjectDetailEndpoint,
	updateProjectRegistrationFormResponseEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi } from "./core";

/**
 * POST /project/create
 * 企画を作成
 */
export async function createProject(
	body: CreateProjectRequest
): Promise<CreateProjectResponse> {
	return callBodyApi(createProjectEndpoint, body);
}

/**
 * GET /project/list
 * ユーザーが参加している企画を取得
 */
export async function listMyProjects(): Promise<ListMyProjectsResponse> {
	return callGetApi(listMyProjectsEndpoint);
}

/**
 * GET /project/:projectId/members
 * 企画メンバー一覧を取得
 */
export function listProjectMembers(
	projectId: string
): Promise<ListProjectMembersResponse> {
	return callGetApi(listProjectMembersEndpoint, {
		pathParams: { projectId },
	});
}

/**
 * POST /project/join
 * 企画参加コードで企画に参加
 */
export async function joinProject(
	body: JoinProjectRequest
): Promise<JoinProjectResponse> {
	return callBodyApi(joinProjectEndpoint, body);
}

/**
 * GET /project/:projectId/detail
 * 企画の詳細を取得（企画参加コード含む）
 */
export async function getProjectDetail(
	projectId: string
): Promise<GetProjectDetailResponse> {
	return callGetApi(getProjectDetailEndpoint, {
		pathParams: { projectId },
	});
}

/**
 * GET /project/:projectId/registration-form-responses
 * 企画登録フォーム回答一覧を取得
 */
export async function getProjectRegistrationFormResponses(
	projectId: string
): Promise<GetProjectRegistrationFormResponsesResponse> {
	return callGetApi(getProjectRegistrationFormResponsesEndpoint, {
		pathParams: { projectId },
	});
}

/**
 * POST /project/:projectId/registration-form-responses
 * 企画登録フォーム回答を新規作成
 */
export async function createProjectRegistrationFormResponse(
	projectId: string,
	body: CreateProjectRegistrationFormResponseRequest
): Promise<CreateProjectRegistrationFormResponseResponse> {
	return callBodyApi(createProjectRegistrationFormResponseEndpoint, body, {
		pathParams: { projectId },
	});
}

/**
 * PATCH /project/:projectId/detail
 * 企画の設定変更（名前・団体名等）
 */
export async function updateProjectDetail(
	projectId: string,
	body: UpdateProjectDetailRequest
): Promise<UpdateProjectDetailResponse> {
	return callBodyApi(updateProjectDetailEndpoint, body, {
		pathParams: { projectId },
	});
}

/**
 * POST /project/:projectId/invite-code/regenerate
 * 企画参加コードを再生成
 */
export async function regenerateInviteCode(
	projectId: string
): Promise<RegenerateInviteCodeResponse> {
	return callBodyApi(regenerateInviteCodeEndpoint, undefined, {
		pathParams: { projectId },
	});
}

/**
 * POST /project/:projectId/members/:userId/remove
 * 企画メンバーを削除
 */
export async function removeProjectMember(
	projectId: string,
	userId: string
): Promise<RemoveProjectMemberResponse> {
	return callBodyApi(removeProjectMemberEndpoint, undefined, {
		pathParams: { projectId, userId },
	});
}

/**
 * POST /project/:projectId/members/:userId/assign
 * 企画メンバーに副企画責任者リクエストを送る
 */
export async function assignSubOwner(
	projectId: string,
	userId: string
): Promise<AssignSubOwnerResponse> {
	return callBodyApi(assignSubOwnerEndpoint, undefined, {
		pathParams: { projectId, userId },
	});
}

/**
 * POST /project/:projectId/sub-owner-request/approve
 * 副企画責任者リクエストを承認
 */
export async function approveSubOwnerRequest(
	projectId: string
): Promise<DecideSubOwnerRequestResponse> {
	return callBodyApi(approveSubOwnerRequestEndpoint, undefined, {
		pathParams: { projectId },
	});
}

/**
 * POST /project/:projectId/sub-owner-request/cancel
 * 副企画責任者リクエストを取り消し
 */
export async function cancelSubOwnerRequest(
	projectId: string
): Promise<DecideSubOwnerRequestResponse> {
	return callBodyApi(cancelSubOwnerRequestEndpoint, undefined, {
		pathParams: { projectId },
	});
}

/**
 * POST /project/:projectId/sub-owner-request/reject
 * 副企画責任者リクエストを辞退
 */
export async function rejectSubOwnerRequest(
	projectId: string
): Promise<DecideSubOwnerRequestResponse> {
	return callBodyApi(rejectSubOwnerRequestEndpoint, undefined, {
		pathParams: { projectId },
	});
}

/**
 * GET /project/application-period
 * 企画応募期間の情報を取得
 */
export async function getApplicationPeriod(): Promise<GetApplicationPeriodResponse> {
	return callGetApi(getApplicationPeriodEndpoint);
}

/**
 * PATCH /project/:projectId/registration-form-responses/:responseId
 * 企画登録フォーム回答を編集
 */
export async function updateProjectRegistrationFormResponse(
	projectId: string,
	responseId: string,
	body: UpdateProjectRegistrationFormResponseRequest
): Promise<UpdateProjectRegistrationFormResponseResponse> {
	return callBodyApi(updateProjectRegistrationFormResponseEndpoint, body, {
		pathParams: { projectId, responseId },
	});
}
