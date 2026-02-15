import {
	createProjectRequestSchema,
	createProjectResponseSchema,
	listMyProjectsResponseSchema,
	listProjectMembersResponseSchema,
	projectIdPathParamsSchema,
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
