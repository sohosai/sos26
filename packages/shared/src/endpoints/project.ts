import {
	createProjectRequestSchema,
	createProjectResponseSchema,
	getProjectDetailResponseSchema,
	joinProjectRequestSchema,
	joinProjectResponseSchema,
	listMyProjectsResponseSchema,
	listProjectMembersResponseSchema,
	projectIdPathParamsSchema,
	projectMemberPathParamsSchema,
	promoteSubOwnerRequestSchema,
	promoteSubOwnerResponseSchema,
	regenerateInviteCodeRequestSchema,
	regenerateInviteCodeResponseSchema,
	removeProjectMemberRequestSchema,
	removeProjectMemberResponseSchema,
	updateProjectDetailRequestSchema,
	updateProjectDetailResponseSchema,
} from "../schemas/project";
import type { BodyEndpoint, GetEndpoint } from "./types";

/**
 * POST /project/create
 * 企画を作成
 *
 * - 認証必須
 * - inviteCode は自動生成
 */
export const createProjectEndpoint: BodyEndpoint<
	"POST",
	"/project/create",
	undefined,
	undefined,
	typeof createProjectRequestSchema,
	typeof createProjectResponseSchema
> = {
	method: "POST",
	path: "/project/create",
	pathParams: undefined,
	query: undefined,
	request: createProjectRequestSchema,
	response: createProjectResponseSchema,
} as const;

/**
 * GET /project/list
 * 自分が参加している企画一覧を取得
 */
export const listMyProjectsEndpoint: GetEndpoint<
	"/project/list",
	undefined,
	undefined,
	typeof listMyProjectsResponseSchema
> = {
	method: "GET",
	path: "/project/list",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listMyProjectsResponseSchema,
} as const;

/**
 * GET /project/:projectId/members
 * 該当するprojectIdのメンバー一覧を取得
 */
export const listProjectMembersEndpoint: GetEndpoint<
	"/project/:projectId/members",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof listProjectMembersResponseSchema
> = {
	method: "GET",
	path: "/project/:projectId/members",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: listProjectMembersResponseSchema,
} as const;

/**
 * POST /project/join
 * 招待コードで企画に参加
 */
export const joinProjectEndpoint: BodyEndpoint<
	"POST",
	"/project/join",
	undefined,
	undefined,
	typeof joinProjectRequestSchema,
	typeof joinProjectResponseSchema
> = {
	method: "POST",
	path: "/project/join",
	pathParams: undefined,
	query: undefined,
	request: joinProjectRequestSchema,
	response: joinProjectResponseSchema,
} as const;

/**
 * GET /project/:projectId/detail
 * 企画の詳細を取得（招待コード含む）
 */
export const getProjectDetailEndpoint: GetEndpoint<
	"/project/:projectId/detail",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof getProjectDetailResponseSchema
> = {
	method: "GET",
	path: "/project/:projectId/detail",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: getProjectDetailResponseSchema,
} as const;

/**
 * PATCH /project/:projectId/detail
 * 企画の設定変更（名前・団体名等）
 *
 * - requireProjectMember + OWNER のみ
 */
export const updateProjectDetailEndpoint: BodyEndpoint<
	"PATCH",
	"/project/:projectId/detail",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof updateProjectDetailRequestSchema,
	typeof updateProjectDetailResponseSchema
> = {
	method: "PATCH",
	path: "/project/:projectId/detail",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: updateProjectDetailRequestSchema,
	response: updateProjectDetailResponseSchema,
} as const;

/**
 * POST /project/:projectId/invite-code/regenerate
 * 招待コードを再生成
 *
 * - requireProjectMember + OWNER のみ
 */
export const regenerateInviteCodeEndpoint: BodyEndpoint<
	"POST",
	"/project/:projectId/invite-code/regenerate",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof regenerateInviteCodeRequestSchema,
	typeof regenerateInviteCodeResponseSchema
> = {
	method: "POST",
	path: "/project/:projectId/invite-code/regenerate",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: regenerateInviteCodeRequestSchema,
	response: regenerateInviteCodeResponseSchema,
} as const;

/**
 * POST /project/:projectId/members/:userId/remove
 * プロジェクトメンバーを論理削除
 */
export const removeProjectMemberEndpoint: BodyEndpoint<
	"POST",
	"/project/:projectId/members/:userId/remove",
	typeof projectMemberPathParamsSchema,
	undefined,
	typeof removeProjectMemberRequestSchema,
	typeof removeProjectMemberResponseSchema
> = {
	method: "POST",
	path: "/project/:projectId/members/:userId/remove",
	pathParams: projectMemberPathParamsSchema,
	query: undefined,
	request: removeProjectMemberRequestSchema,
	response: removeProjectMemberResponseSchema,
} as const;

/**
 * POST /project/:projectId/members/:userId/promote
 * プロジェクトメンバーを副責任者に任命
 */
export const promoteSubOwnerEndpoint: BodyEndpoint<
	"POST",
	"/project/:projectId/members/:userId/promote",
	typeof projectMemberPathParamsSchema,
	undefined,
	typeof promoteSubOwnerRequestSchema,
	typeof promoteSubOwnerResponseSchema
> = {
	method: "POST",
	path: "/project/:projectId/members/:userId/promote",
	pathParams: projectMemberPathParamsSchema,
	query: undefined,
	request: promoteSubOwnerRequestSchema,
	response: promoteSubOwnerResponseSchema,
} as const;
