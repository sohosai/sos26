import {
	createProjectRequestSchema,
	createProjectResponseSchema,
	joinProjectRequestSchema,
	joinProjectResponseSchema,
	listMyProjectsResponseSchema,
	listProjectMembersResponseSchema,
	projectIdPathParamsSchema,
	projectMemberPathParamsSchema,
	promoteSubOwnerRequestSchema,
	promoteSubOwnerResponseSchema,
	removeProjectMemberRequestSchema,
	removeProjectMemberResponseSchema,
} from "../schemas/project";
import type { BodyEndpoint, GetEndpoint } from "./types";

/**
 * POST /projects
 * 企画を作成
 *
 * - 認証必須
 * - ownerId のユーザーが存在すること
 * - subOwnerId は任意
 * - inviteCode は自動生成
 */
export const createProjectEndpoint: BodyEndpoint<
	"POST",
	"/projects/subscribe",
	undefined,
	undefined,
	typeof createProjectRequestSchema,
	typeof createProjectResponseSchema
> = {
	method: "POST",
	path: "/projects/subscribe",
	pathParams: undefined,
	query: undefined,
	request: createProjectRequestSchema,
	response: createProjectResponseSchema,
} as const;

/**
 * GET /projects
 * 自分が参加している企画一覧を取得
 */
export const listMyProjectsEndpoint: GetEndpoint<
	"/projects",
	undefined,
	undefined,
	typeof listMyProjectsResponseSchema
> = {
	method: "GET",
	path: "/projects",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listMyProjectsResponseSchema,
} as const;

/**
 * GET /projects/:projectId/members
 * 該当するprojectIdのメンバー一覧を取得
 */
export const listProjectMembersEndpoint: GetEndpoint<
	"/projects/:projectId/members",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof listProjectMembersResponseSchema
> = {
	method: "GET",
	path: "/projects/:projectId/members",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: listProjectMembersResponseSchema,
} as const;

/**
 * POST /projects/join
 * 招待コードで企画に参加
 */
export const joinProjectEndpoint: BodyEndpoint<
	"POST",
	"/projects/join",
	undefined,
	undefined,
	typeof joinProjectRequestSchema,
	typeof joinProjectResponseSchema
> = {
	method: "POST",
	path: "/projects/join",
	pathParams: undefined,
	query: undefined,
	request: joinProjectRequestSchema,
	response: joinProjectResponseSchema,
} as const;

/**
 * POST /projects/:projectId/members/:userId/remove
 * プロジェクトメンバーを論理削除
 */
export const removeProjectMemberEndpoint: BodyEndpoint<
	"POST",
	"/projects/:projectId/members/:userId/remove",
	typeof projectMemberPathParamsSchema,
	undefined,
	typeof removeProjectMemberRequestSchema,
	typeof removeProjectMemberResponseSchema
> = {
	method: "POST",
	path: "/projects/:projectId/members/:userId/remove",
	pathParams: projectMemberPathParamsSchema,
	query: undefined,
	request: removeProjectMemberRequestSchema,
	response: removeProjectMemberResponseSchema,
} as const;

/**
 * POST /projects/:projectId/members/:userId/promote
 * プロジェクトメンバーを副責任者に任命
 */
export const promoteSubOwnerEndpoint: BodyEndpoint<
	"POST",
	"/projects/:projectId/members/:userId/promote",
	typeof projectMemberPathParamsSchema,
	undefined,
	typeof promoteSubOwnerRequestSchema,
	typeof promoteSubOwnerResponseSchema
> = {
	method: "POST",
	path: "/projects/:projectId/members/:userId/promote",
	pathParams: projectMemberPathParamsSchema,
	query: undefined,
	request: promoteSubOwnerRequestSchema,
	response: promoteSubOwnerResponseSchema,
} as const;
