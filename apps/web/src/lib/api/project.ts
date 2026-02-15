import {
	type CreateProjectRequest,
	type CreateProjectResponse,
	createProjectEndpoint,
	type ListMyProjectsResponse,
	type ListProjectMembersResponse,
	listMyProjectsEndpoint,
	listProjectMembersEndpoint,
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
