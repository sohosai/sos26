import {
	type CreateProjectRequest,
	type CreateProjectResponse,
	createProjectEndpoint,
	type JoinProjectRequest,
	type JoinProjectResponse,
	joinProjectEndpoint,
	type ListMyProjectsResponse,
	type ListProjectMembersResponse,
	listMyProjectsEndpoint,
	listProjectMembersEndpoint,
	type PromoteSubOwnerResponse,
	promoteSubOwnerEndpoint,
	type RemoveProjectMemberResponse,
	removeProjectMemberEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi } from "./core";

/**
 * POST /projects/subscribe
 * 企画を作成
 */
export async function createProject(
	body: CreateProjectRequest
): Promise<CreateProjectResponse> {
	return callBodyApi(createProjectEndpoint, body);
}

/**
 * GET /projects
 * ユーザーが参加している企画を取得
 */
export async function listMyProjects(): Promise<ListMyProjectsResponse> {
	return callGetApi(listMyProjectsEndpoint);
}

export function listProjectMembers(
	projectId: string
): Promise<ListProjectMembersResponse> {
	return callGetApi(listProjectMembersEndpoint, {
		pathParams: { projectId },
	});
}

/**
 * POST /projects/join
 * 招待コードで企画に参加
 */
export async function joinProject(
	body: JoinProjectRequest
): Promise<JoinProjectResponse> {
	return callBodyApi(joinProjectEndpoint, body);
}

/**
 * POST /projects/:projectId/members/:userId/remove
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
 * POST /projects/:projectId/members/:userId/promote
 * プロジェクトメンバーを副責任者に任命
 */
export async function promoteSubOwner(
	projectId: string,
	userId: string
): Promise<PromoteSubOwnerResponse> {
	return callBodyApi(promoteSubOwnerEndpoint, undefined, {
		pathParams: { projectId, userId },
	});
}
