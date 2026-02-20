import {
	getCommitteeProjectDetailResponseSchema,
	listCommitteeProjectMembersResponseSchema,
	listCommitteeProjectsQuerySchema,
	listCommitteeProjectsResponseSchema,
} from "../schemas/committee-project";
import { projectIdPathParamsSchema } from "../schemas/project";
import type { GetEndpoint } from "./types";

/**
 * GET /committee/projects
 * 全企画一覧（フィルタ・検索・ページネーション）
 *
 * - 認証 + 実委メンバー必須
 */
export const listCommitteeProjectsEndpoint: GetEndpoint<
	"/committee/projects",
	undefined,
	typeof listCommitteeProjectsQuerySchema,
	typeof listCommitteeProjectsResponseSchema
> = {
	method: "GET",
	path: "/committee/projects",
	pathParams: undefined,
	query: listCommitteeProjectsQuerySchema,
	request: undefined,
	response: listCommitteeProjectsResponseSchema,
} as const;

/**
 * GET /committee/projects/:projectId
 * 企画詳細（メンバー数・owner/subOwner情報含む）
 *
 * - 認証 + 実委メンバー必須
 */
export const getCommitteeProjectDetailEndpoint: GetEndpoint<
	"/committee/projects/:projectId",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof getCommitteeProjectDetailResponseSchema
> = {
	method: "GET",
	path: "/committee/projects/:projectId",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: getCommitteeProjectDetailResponseSchema,
} as const;

/**
 * GET /committee/projects/:projectId/members
 * 企画メンバー一覧
 *
 * - 認証 + 実委メンバー必須
 */
export const listCommitteeProjectMembersEndpoint: GetEndpoint<
	"/committee/projects/:projectId/members",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof listCommitteeProjectMembersResponseSchema
> = {
	method: "GET",
	path: "/committee/projects/:projectId/members",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: listCommitteeProjectMembersResponseSchema,
} as const;
