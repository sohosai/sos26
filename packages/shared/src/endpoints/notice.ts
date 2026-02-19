import {
	addCollaboratorRequestSchema,
	addCollaboratorResponseSchema,
	createNoticeAuthorizationRequestSchema,
	createNoticeAuthorizationResponseSchema,
	createNoticeRequestSchema,
	createNoticeResponseSchema,
	deleteNoticeResponseSchema,
	getNoticeResponseSchema,
	getProjectNoticeResponseSchema,
	listNoticesResponseSchema,
	listProjectNoticesResponseSchema,
	noticeAuthorizationIdPathParamsSchema,
	noticeCollaboratorIdPathParamsSchema,
	noticeIdPathParamsSchema,
	projectNoticeIdPathParamsSchema,
	readProjectNoticeResponseSchema,
	removeCollaboratorResponseSchema,
	updateNoticeAuthorizationRequestSchema,
	updateNoticeAuthorizationResponseSchema,
	updateNoticeRequestSchema,
	updateNoticeResponseSchema,
} from "../schemas/notice";
import { projectIdPathParamsSchema } from "../schemas/project";
import type { BodyEndpoint, GetEndpoint, NoBodyEndpoint } from "./types";

// ─────────────────────────────────────────────────────────────
// 実委側: /committee/notices
// ─────────────────────────────────────────────────────────────

/**
 * POST /committee/notices
 * お知らせを作成
 */
export const createNoticeEndpoint: BodyEndpoint<
	"POST",
	"/committee/notices",
	undefined,
	undefined,
	typeof createNoticeRequestSchema,
	typeof createNoticeResponseSchema
> = {
	method: "POST",
	path: "/committee/notices",
	pathParams: undefined,
	query: undefined,
	request: createNoticeRequestSchema,
	response: createNoticeResponseSchema,
} as const;

/**
 * GET /committee/notices
 * お知らせ一覧を取得（実委人全員閲覧可）
 */
export const listNoticesEndpoint: GetEndpoint<
	"/committee/notices",
	undefined,
	undefined,
	typeof listNoticesResponseSchema
> = {
	method: "GET",
	path: "/committee/notices",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listNoticesResponseSchema,
} as const;

/**
 * GET /committee/notices/:noticeId
 * お知らせ詳細を取得（実委人全員閲覧可）
 */
export const getNoticeEndpoint: GetEndpoint<
	"/committee/notices/:noticeId",
	typeof noticeIdPathParamsSchema,
	undefined,
	typeof getNoticeResponseSchema
> = {
	method: "GET",
	path: "/committee/notices/:noticeId",
	pathParams: noticeIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: getNoticeResponseSchema,
} as const;

/**
 * PATCH /committee/notices/:noticeId
 * お知らせを編集（owner または共同編集者のみ）
 */
export const updateNoticeEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/notices/:noticeId",
	typeof noticeIdPathParamsSchema,
	undefined,
	typeof updateNoticeRequestSchema,
	typeof updateNoticeResponseSchema
> = {
	method: "PATCH",
	path: "/committee/notices/:noticeId",
	pathParams: noticeIdPathParamsSchema,
	query: undefined,
	request: updateNoticeRequestSchema,
	response: updateNoticeResponseSchema,
} as const;

/**
 * DELETE /committee/notices/:noticeId
 * お知らせを削除（owner のみ）
 */
export const deleteNoticeEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/notices/:noticeId",
	typeof noticeIdPathParamsSchema,
	undefined,
	typeof deleteNoticeResponseSchema
> = {
	method: "DELETE",
	path: "/committee/notices/:noticeId",
	pathParams: noticeIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: deleteNoticeResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// 実委側: 共同編集者
// ─────────────────────────────────────────────────────────────

/**
 * POST /committee/notices/:noticeId/collaborators
 * 共同編集者を追加（owner のみ）
 */
export const addCollaboratorEndpoint: BodyEndpoint<
	"POST",
	"/committee/notices/:noticeId/collaborators",
	typeof noticeIdPathParamsSchema,
	undefined,
	typeof addCollaboratorRequestSchema,
	typeof addCollaboratorResponseSchema
> = {
	method: "POST",
	path: "/committee/notices/:noticeId/collaborators",
	pathParams: noticeIdPathParamsSchema,
	query: undefined,
	request: addCollaboratorRequestSchema,
	response: addCollaboratorResponseSchema,
} as const;

/**
 * DELETE /committee/notices/:noticeId/collaborators/:collaboratorId
 * 共同編集者を削除（owner のみ）
 */
export const removeCollaboratorEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/notices/:noticeId/collaborators/:collaboratorId",
	typeof noticeCollaboratorIdPathParamsSchema,
	undefined,
	typeof removeCollaboratorResponseSchema
> = {
	method: "DELETE",
	path: "/committee/notices/:noticeId/collaborators/:collaboratorId",
	pathParams: noticeCollaboratorIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: removeCollaboratorResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// 実委側: 配信承認
// ─────────────────────────────────────────────────────────────

/**
 * POST /committee/notices/:noticeId/authorizations
 * 配信承認を申請（owner または共同編集者 + NOTICE_DELIVER 権限）
 */
export const createNoticeAuthorizationEndpoint: BodyEndpoint<
	"POST",
	"/committee/notices/:noticeId/authorizations",
	typeof noticeIdPathParamsSchema,
	undefined,
	typeof createNoticeAuthorizationRequestSchema,
	typeof createNoticeAuthorizationResponseSchema
> = {
	method: "POST",
	path: "/committee/notices/:noticeId/authorizations",
	pathParams: noticeIdPathParamsSchema,
	query: undefined,
	request: createNoticeAuthorizationRequestSchema,
	response: createNoticeAuthorizationResponseSchema,
} as const;

/**
 * PATCH /committee/notices/:noticeId/authorizations/:authorizationId
 * 承認 / 却下（requestedTo 本人のみ）
 */
export const updateNoticeAuthorizationEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/notices/:noticeId/authorizations/:authorizationId",
	typeof noticeAuthorizationIdPathParamsSchema,
	undefined,
	typeof updateNoticeAuthorizationRequestSchema,
	typeof updateNoticeAuthorizationResponseSchema
> = {
	method: "PATCH",
	path: "/committee/notices/:noticeId/authorizations/:authorizationId",
	pathParams: noticeAuthorizationIdPathParamsSchema,
	query: undefined,
	request: updateNoticeAuthorizationRequestSchema,
	response: updateNoticeAuthorizationResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// 企画側: /project/:projectId/notices
// ─────────────────────────────────────────────────────────────

/**
 * GET /project/:projectId/notices
 * 配信済みお知らせ一覧
 */
export const listProjectNoticesEndpoint: GetEndpoint<
	"/project/:projectId/notices",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof listProjectNoticesResponseSchema
> = {
	method: "GET",
	path: "/project/:projectId/notices",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: listProjectNoticesResponseSchema,
} as const;

/**
 * GET /project/:projectId/notices/:noticeId
 * お知らせ詳細
 */
export const getProjectNoticeEndpoint: GetEndpoint<
	"/project/:projectId/notices/:noticeId",
	typeof projectNoticeIdPathParamsSchema,
	undefined,
	typeof getProjectNoticeResponseSchema
> = {
	method: "GET",
	path: "/project/:projectId/notices/:noticeId",
	pathParams: projectNoticeIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: getProjectNoticeResponseSchema,
} as const;

/**
 * POST /project/:projectId/notices/:noticeId/read
 * お知らせを既読にする
 */
export const readProjectNoticeEndpoint: NoBodyEndpoint<
	"POST",
	"/project/:projectId/notices/:noticeId/read",
	typeof projectNoticeIdPathParamsSchema,
	undefined,
	typeof readProjectNoticeResponseSchema
> = {
	method: "POST",
	path: "/project/:projectId/notices/:noticeId/read",
	pathParams: projectNoticeIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: readProjectNoticeResponseSchema,
} as const;
