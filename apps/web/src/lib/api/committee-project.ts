import {
	type GetCommitteeProjectDetailResponse,
	getCommitteeProjectDetailEndpoint,
	type ListCommitteeProjectMembersResponse,
	type ListCommitteeProjectsQuery,
	type ListCommitteeProjectsResponse,
	listCommitteeProjectMembersEndpoint,
	listCommitteeProjectsEndpoint,
} from "@sos26/shared";
import { callGetApi } from "./core";

/**
 * GET /committee/projects
 * 全企画一覧（フィルタ・検索・ページネーション）
 *
 * page/limit はサーバー側で default が適用されるため省略可能
 */
export async function listCommitteeProjects(
	query?: Partial<ListCommitteeProjectsQuery>
): Promise<ListCommitteeProjectsResponse> {
	return callGetApi(listCommitteeProjectsEndpoint, {
		query: query as ListCommitteeProjectsQuery,
	});
}

/**
 * GET /committee/projects/:projectId
 * 企画詳細
 */
export async function getCommitteeProjectDetail(
	projectId: string
): Promise<GetCommitteeProjectDetailResponse> {
	return callGetApi(getCommitteeProjectDetailEndpoint, {
		pathParams: { projectId },
	});
}

/**
 * GET /committee/projects/:projectId/members
 * 企画メンバー一覧
 */
export async function listCommitteeProjectMembers(
	projectId: string
): Promise<ListCommitteeProjectMembersResponse> {
	return callGetApi(listCommitteeProjectMembersEndpoint, {
		pathParams: { projectId },
	});
}
