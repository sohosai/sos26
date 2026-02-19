import {
	type GetCommitteeProjectDetailResponse,
	getCommitteeProjectDetailEndpoint,
	type ListCommitteeProjectMembersResponse,
	type ListCommitteeProjectsQuery,
	type ListCommitteeProjectsQueryInput,
	type ListCommitteeProjectsResponse,
	listCommitteeProjectMembersEndpoint,
	listCommitteeProjectsEndpoint,
} from "@sos26/shared";
import { callGetApi } from "./core";

/**
 * GET /committee/projects
 * 全企画一覧（フィルタ・検索・ページネーション）
 *
 * - limit を省略すると全件取得
 * - page/limit はサーバー側で default が適用されるため入力型を使用
 */
export async function listCommitteeProjects(
	query?: ListCommitteeProjectsQueryInput
): Promise<ListCommitteeProjectsResponse> {
	// callGetApi は z.infer（出力型）を期待するが、サーバー側で default() が適用されるため入力型で安全
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
