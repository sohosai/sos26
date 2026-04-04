import {
	getCommitteeProjectDetailResponseSchema,
	listCommitteeProjectMembersResponseSchema,
	listCommitteeProjectsQuerySchema,
	listCommitteeProjectsResponseSchema,
	updateCommitteeProjectBaseInfoRequestSchema,
	updateCommitteeProjectBaseInfoResponseSchema,
	updateCommitteeProjectDeletionStatusRequestSchema,
	updateCommitteeProjectDeletionStatusResponseSchema,
} from "../schemas/committee-project";
import { projectIdPathParamsSchema } from "../schemas/project";
import type { BodyEndpoint, GetEndpoint } from "./types";

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

/**
 * PATCH /committee/projects/:projectId/base-info
 * 企画の基礎情報を更新
 */
export const updateCommitteeProjectBaseInfoEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/projects/:projectId/base-info",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof updateCommitteeProjectBaseInfoRequestSchema,
	typeof updateCommitteeProjectBaseInfoResponseSchema
> = {
	method: "PATCH",
	path: "/committee/projects/:projectId/base-info",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: updateCommitteeProjectBaseInfoRequestSchema,
	response: updateCommitteeProjectBaseInfoResponseSchema,
} as const;

/**
 * PATCH /committee/projects/:projectId/deletion-status
 * 企画の削除状態を更新（企画中止/落選/取消）
 */
export const updateCommitteeProjectDeletionStatusEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/projects/:projectId/deletion-status",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof updateCommitteeProjectDeletionStatusRequestSchema,
	typeof updateCommitteeProjectDeletionStatusResponseSchema
> = {
	method: "PATCH",
	path: "/committee/projects/:projectId/deletion-status",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: updateCommitteeProjectDeletionStatusRequestSchema,
	response: updateCommitteeProjectDeletionStatusResponseSchema,
} as const;
