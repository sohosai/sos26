import {
	addFormCollaboratorRequestSchema,
	addFormCollaboratorResponseSchema,
	approveFormAuthorizationRequestSchema,
	approveFormAuthorizationResponseSchema,
	createFormRequestSchema,
	createFormResponseSchema,
	deleteFormResponseSchema,
	formAuthorizationPathParamsSchema,
	formCollaboratorPathParamsSchema,
	formIdPathParamsSchema,
	getFormDetailResponseSchema,
	listFormResponsesResponseSchema,
	listMyFormsResponseSchema,
	rejectFormAuthorizationRequestSchema,
	rejectFormAuthorizationResponseSchema,
	removeFormCollaboratorResponseSchema,
	requestFormAuthorizationRequestSchema,
	requestFormAuthorizationResponseSchema,
	updateFormDetailRequestSchema,
	updateFormDetailResponseSchema,
} from "../schemas/form";
import type { BodyEndpoint, GetEndpoint, NoBodyEndpoint } from "./types";

/**
 * POST /committee/forms/create
 * フォームを作成
 *
 * - 認証必須
 */
export const createFormEndpoint: BodyEndpoint<
	"POST",
	"/committee/forms/create",
	undefined,
	undefined,
	typeof createFormRequestSchema,
	typeof createFormResponseSchema
> = {
	method: "POST",
	path: "/committee/forms/create",
	pathParams: undefined,
	query: undefined,
	request: createFormRequestSchema,
	response: createFormResponseSchema,
} as const;

/**
 * GET /committee/forms/list
 * 自分が作成・共同編集しているフォーム一覧を取得
 */
export const listMyFormsEndpoint: GetEndpoint<
	"/committee/forms/list",
	undefined,
	undefined,
	typeof listMyFormsResponseSchema
> = {
	method: "GET",
	path: "/committee/forms/list",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listMyFormsResponseSchema,
} as const;

/**
 * GET /committee/forms/:formId/detail
 * フォームの詳細を取得（項目含む）
 */
export const getFormDetailEndpoint: GetEndpoint<
	"/committee/forms/:formId/detail",
	typeof formIdPathParamsSchema,
	undefined,
	typeof getFormDetailResponseSchema
> = {
	method: "GET",
	path: "/committee/forms/:formId/detail",
	pathParams: formIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: getFormDetailResponseSchema,
} as const;

/**
 * PATCH /committee/forms/:formId/detail
 * フォームのタイトル・説明を更新
 *
 * - 作成者または書き込み権限付き共同編集者のみ
 */
export const updateFormDetailEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/forms/:formId/detail",
	typeof formIdPathParamsSchema,
	undefined,
	typeof updateFormDetailRequestSchema,
	typeof updateFormDetailResponseSchema
> = {
	method: "PATCH",
	path: "/committee/forms/:formId/detail",
	pathParams: formIdPathParamsSchema,
	query: undefined,
	request: updateFormDetailRequestSchema,
	response: updateFormDetailResponseSchema,
} as const;

/**
 * DELETE /committee/forms/:formId
 * フォームを論理削除
 *
 * - 作成者のみ
 */
export const deleteFormEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/forms/:formId",
	typeof formIdPathParamsSchema,
	undefined,
	typeof deleteFormResponseSchema
> = {
	method: "DELETE",
	path: "/committee/forms/:formId",
	pathParams: formIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: deleteFormResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// 共同編集者
// ─────────────────────────────────────────────────────────────

/**
 * POST /committee/forms/:formId/collaborators/:userId
 * 共同編集者を追加
 *
 * - 作成者のみ
 */
export const addFormCollaboratorEndpoint: BodyEndpoint<
	"POST",
	"/committee/forms/:formId/collaborators/:userId",
	typeof formCollaboratorPathParamsSchema,
	undefined,
	typeof addFormCollaboratorRequestSchema,
	typeof addFormCollaboratorResponseSchema
> = {
	method: "POST",
	path: "/committee/forms/:formId/collaborators/:userId",
	pathParams: formCollaboratorPathParamsSchema,
	query: undefined,
	request: addFormCollaboratorRequestSchema,
	response: addFormCollaboratorResponseSchema,
} as const;

/**
 * DELETE /committee/forms/:formId/collaborators/:userId
 * 共同編集者を削除
 *
 * - 作成者のみ
 */
export const removeFormCollaboratorEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/forms/:formId/collaborators/:userId",
	typeof formCollaboratorPathParamsSchema,
	undefined,
	typeof removeFormCollaboratorResponseSchema
> = {
	method: "DELETE",
	path: "/committee/forms/:formId/collaborators/:userId",
	pathParams: formCollaboratorPathParamsSchema,
	query: undefined,
	request: undefined,
	response: removeFormCollaboratorResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// 承認フロー
// ─────────────────────────────────────────────────────────────

/**
 * POST /committee/forms/:formId/authorizations
 * 配信承認をリクエスト
 *
 * - 作成者または書き込み権限付き共同編集者のみ
 */
export const requestFormAuthorizationEndpoint: BodyEndpoint<
	"POST",
	"/committee/forms/:formId/authorizations",
	typeof formIdPathParamsSchema,
	undefined,
	typeof requestFormAuthorizationRequestSchema,
	typeof requestFormAuthorizationResponseSchema
> = {
	method: "POST",
	path: "/committee/forms/:formId/authorizations",
	pathParams: formIdPathParamsSchema,
	query: undefined,
	request: requestFormAuthorizationRequestSchema,
	response: requestFormAuthorizationResponseSchema,
} as const;

/**
 * POST /committee/forms/:formId/authorizations/:authorizationId/approve
 * 配信承認を承認
 *
 * - requestedTo のユーザーのみ
 */
export const approveFormAuthorizationEndpoint: BodyEndpoint<
	"POST",
	"/committee/forms/:formId/authorizations/:authorizationId/approve",
	typeof formAuthorizationPathParamsSchema,
	undefined,
	typeof approveFormAuthorizationRequestSchema,
	typeof approveFormAuthorizationResponseSchema
> = {
	method: "POST",
	path: "/committee/forms/:formId/authorizations/:authorizationId/approve",
	pathParams: formAuthorizationPathParamsSchema,
	query: undefined,
	request: approveFormAuthorizationRequestSchema,
	response: approveFormAuthorizationResponseSchema,
} as const;

/**
 * POST /committee/forms/:formId/authorizations/:authorizationId/reject
 * 配信承認を却下
 *
 * - requestedTo のユーザーのみ
 */
export const rejectFormAuthorizationEndpoint: BodyEndpoint<
	"POST",
	"/committee/forms/:formId/authorizations/:authorizationId/reject",
	typeof formAuthorizationPathParamsSchema,
	undefined,
	typeof rejectFormAuthorizationRequestSchema,
	typeof rejectFormAuthorizationResponseSchema
> = {
	method: "POST",
	path: "/committee/forms/:formId/authorizations/:authorizationId/reject",
	pathParams: formAuthorizationPathParamsSchema,
	query: undefined,
	request: rejectFormAuthorizationRequestSchema,
	response: rejectFormAuthorizationResponseSchema,
} as const;

export const listFormResponsesEndpoint: GetEndpoint<
	"/committee/forms/:formId/responses",
	typeof formIdPathParamsSchema,
	undefined,
	typeof listFormResponsesResponseSchema
> = {
	method: "GET",
	path: "/committee/forms/:formId/responses",
	pathParams: formIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: listFormResponsesResponseSchema,
} as const;
