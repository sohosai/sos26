import {
	type AssignSubOwnerResponse,
	approveSubOwnerRequestEndpoint,
	assignSubOwnerEndpoint,
	type CreateProjectRequest,
	type CreateProjectResponse,
	cancelSubOwnerRequestEndpoint,
	createProjectEndpoint,
	type DecideSubOwnerRequestResponse,
	type GetProjectDetailResponse,
	type GetProjectRegistrationFormResponsesResponse,
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
	updateProjectDetailEndpoint,
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
 * 招待コードで企画に参加
 */
export async function joinProject(
	body: JoinProjectRequest
): Promise<JoinProjectResponse> {
	return callBodyApi(joinProjectEndpoint, body);
}

/**
 * GET /project/:projectId/detail
 * 企画の詳細を取得（招待コード含む）
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
 * 招待コードを再生成
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
 * プロジェクトメンバーを削除
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
 * プロジェクトメンバーに副責任者リクエストを送る
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
 * 副責任者リクエストを承認
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
 * 副責任者リクエストを取り消し
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
 * 副責任者リクエストを辞退
 */
export async function rejectSubOwnerRequest(
	projectId: string
): Promise<DecideSubOwnerRequestResponse> {
	return callBodyApi(rejectSubOwnerRequestEndpoint, undefined, {
		pathParams: { projectId },
	});
}
