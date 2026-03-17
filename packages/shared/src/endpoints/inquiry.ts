import {
	addInquiryAssigneeRequestSchema,
	addInquiryAssigneeResponseSchema,
	addInquiryCommentRequestSchema,
	addInquiryCommentResponseSchema,
	committeeInquiryAssigneeIdPathParamsSchema,
	createCommitteeInquiryRequestSchema,
	createCommitteeInquiryResponseSchema,
	createProjectInquiryRequestSchema,
	createProjectInquiryResponseSchema,
	deleteInquiryCommentResponseSchema,
	deleteInquiryResponseSchema,
	getCommitteeInquiryResponseSchema,
	getProjectInquiryResponseSchema,
	inquiryCommentIdPathParamsSchema,
	inquiryIdPathParamsSchema,
	listCommitteeInquiriesResponseSchema,
	listProjectInquiriesResponseSchema,
	projectInquiryAssigneeIdPathParamsSchema,
	projectInquiryIdPathParamsSchema,
	publishDraftCommentResponseSchema,
	publishDraftInquiryResponseSchema,
	removeInquiryAssigneeResponseSchema,
	reopenInquiryResponseSchema,
	updateDraftCommentRequestSchema,
	updateDraftCommentResponseSchema,
	updateDraftInquiryRequestSchema,
	updateDraftInquiryResponseSchema,
	updateInquiryStatusRequestSchema,
	updateInquiryStatusResponseSchema,
	updateInquiryViewersRequestSchema,
	updateInquiryViewersResponseSchema,
} from "../schemas/inquiry";
import { projectIdPathParamsSchema } from "../schemas/project";
import type {
	BodyEndpoint,
	Endpoint,
	GetEndpoint,
	NoBodyEndpoint,
} from "./types";

// ─────────────────────────────────────────────────────────────
// 企画側: /project/:projectId/inquiries
// ─────────────────────────────────────────────────────────────

/**
 * GET /project/:projectId/inquiries
 * 企画側お問い合わせ一覧を取得（自分が担当者のもの）
 */
export const listProjectInquiriesEndpoint: GetEndpoint<
	"/project/:projectId/inquiries",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof listProjectInquiriesResponseSchema
> = {
	method: "GET",
	path: "/project/:projectId/inquiries",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: listProjectInquiriesResponseSchema,
} as const;

/**
 * GET /project/:projectId/inquiries/:inquiryId
 * 企画側お問い合わせ詳細を取得
 */
export const getProjectInquiryEndpoint: GetEndpoint<
	"/project/:projectId/inquiries/:inquiryId",
	typeof projectInquiryIdPathParamsSchema,
	undefined,
	typeof getProjectInquiryResponseSchema
> = {
	method: "GET",
	path: "/project/:projectId/inquiries/:inquiryId",
	pathParams: projectInquiryIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: getProjectInquiryResponseSchema,
} as const;

/**
 * POST /project/:projectId/inquiries
 * 企画側からお問い合わせを作成
 */
export const createProjectInquiryEndpoint: BodyEndpoint<
	"POST",
	"/project/:projectId/inquiries",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof createProjectInquiryRequestSchema,
	typeof createProjectInquiryResponseSchema
> = {
	method: "POST",
	path: "/project/:projectId/inquiries",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: createProjectInquiryRequestSchema,
	response: createProjectInquiryResponseSchema,
} as const;

/**
 * POST /project/:projectId/inquiries/:inquiryId/comments
 * 企画側からコメントを追加
 */
export const addProjectInquiryCommentEndpoint: BodyEndpoint<
	"POST",
	"/project/:projectId/inquiries/:inquiryId/comments",
	typeof projectInquiryIdPathParamsSchema,
	undefined,
	typeof addInquiryCommentRequestSchema,
	typeof addInquiryCommentResponseSchema
> = {
	method: "POST",
	path: "/project/:projectId/inquiries/:inquiryId/comments",
	pathParams: projectInquiryIdPathParamsSchema,
	query: undefined,
	request: addInquiryCommentRequestSchema,
	response: addInquiryCommentResponseSchema,
} as const;

/**
 * PATCH /project/:projectId/inquiries/:inquiryId/reopen
 * 企画側から再オープン（RESOLVED → IN_PROGRESS）
 *
 * bodyを持たないPATCHのため、BodyEndpoint/NoBodyEndpoint ではなく Endpoint を直接使用
 */
export const reopenProjectInquiryEndpoint: Endpoint<
	"PATCH",
	"/project/:projectId/inquiries/:inquiryId/reopen",
	typeof projectInquiryIdPathParamsSchema,
	undefined,
	undefined,
	typeof reopenInquiryResponseSchema
> = {
	method: "PATCH",
	path: "/project/:projectId/inquiries/:inquiryId/reopen",
	pathParams: projectInquiryIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: reopenInquiryResponseSchema,
} as const;

/**
 * POST /project/:projectId/inquiries/:inquiryId/assignees
 * 企画側から担当者を追加（同企画メンバーのみ）
 */
export const addProjectInquiryAssigneeEndpoint: BodyEndpoint<
	"POST",
	"/project/:projectId/inquiries/:inquiryId/assignees",
	typeof projectInquiryIdPathParamsSchema,
	undefined,
	typeof addInquiryAssigneeRequestSchema,
	typeof addInquiryAssigneeResponseSchema
> = {
	method: "POST",
	path: "/project/:projectId/inquiries/:inquiryId/assignees",
	pathParams: projectInquiryIdPathParamsSchema,
	query: undefined,
	request: addInquiryAssigneeRequestSchema,
	response: addInquiryAssigneeResponseSchema,
} as const;

/**
 * DELETE /project/:projectId/inquiries/:inquiryId/assignees/:assigneeId
 * 企画側から担当者を削除（作成者は削除不可）
 */
export const removeProjectInquiryAssigneeEndpoint: NoBodyEndpoint<
	"DELETE",
	"/project/:projectId/inquiries/:inquiryId/assignees/:assigneeId",
	typeof projectInquiryAssigneeIdPathParamsSchema,
	undefined,
	typeof removeInquiryAssigneeResponseSchema
> = {
	method: "DELETE",
	path: "/project/:projectId/inquiries/:inquiryId/assignees/:assigneeId",
	pathParams: projectInquiryAssigneeIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: removeInquiryAssigneeResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// 実委側: /committee/inquiries
// ─────────────────────────────────────────────────────────────

/**
 * GET /committee/inquiries
 * 実委側お問い合わせ一覧を取得
 * - 管理者: 全件
 * - 担当者: 自分が担当のもの
 * - 閲覧者: 閲覧可能なもの
 */
export const listCommitteeInquiriesEndpoint: GetEndpoint<
	"/committee/inquiries",
	undefined,
	undefined,
	typeof listCommitteeInquiriesResponseSchema
> = {
	method: "GET",
	path: "/committee/inquiries",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listCommitteeInquiriesResponseSchema,
} as const;

/**
 * GET /committee/inquiries/:inquiryId
 * 実委側お問い合わせ詳細を取得（閲覧権限チェックあり）
 */
export const getCommitteeInquiryEndpoint: GetEndpoint<
	"/committee/inquiries/:inquiryId",
	typeof inquiryIdPathParamsSchema,
	undefined,
	typeof getCommitteeInquiryResponseSchema
> = {
	method: "GET",
	path: "/committee/inquiries/:inquiryId",
	pathParams: inquiryIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: getCommitteeInquiryResponseSchema,
} as const;

/**
 * POST /committee/inquiries
 * 実委側からお問い合わせを作成（企画側担当者の指定が必須）
 */
export const createCommitteeInquiryEndpoint: BodyEndpoint<
	"POST",
	"/committee/inquiries",
	undefined,
	undefined,
	typeof createCommitteeInquiryRequestSchema,
	typeof createCommitteeInquiryResponseSchema
> = {
	method: "POST",
	path: "/committee/inquiries",
	pathParams: undefined,
	query: undefined,
	request: createCommitteeInquiryRequestSchema,
	response: createCommitteeInquiryResponseSchema,
} as const;

/**
 * POST /committee/inquiries/:inquiryId/comments
 * 実委側からコメントを追加（担当者 or 管理者のみ）
 */
export const addCommitteeInquiryCommentEndpoint: BodyEndpoint<
	"POST",
	"/committee/inquiries/:inquiryId/comments",
	typeof inquiryIdPathParamsSchema,
	undefined,
	typeof addInquiryCommentRequestSchema,
	typeof addInquiryCommentResponseSchema
> = {
	method: "POST",
	path: "/committee/inquiries/:inquiryId/comments",
	pathParams: inquiryIdPathParamsSchema,
	query: undefined,
	request: addInquiryCommentRequestSchema,
	response: addInquiryCommentResponseSchema,
} as const;

/**
 * PATCH /committee/inquiries/:inquiryId/status
 * ステータスを解決済みに変更（担当者 or 管理者のみ）
 */
export const updateCommitteeInquiryStatusEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/inquiries/:inquiryId/status",
	typeof inquiryIdPathParamsSchema,
	undefined,
	typeof updateInquiryStatusRequestSchema,
	typeof updateInquiryStatusResponseSchema
> = {
	method: "PATCH",
	path: "/committee/inquiries/:inquiryId/status",
	pathParams: inquiryIdPathParamsSchema,
	query: undefined,
	request: updateInquiryStatusRequestSchema,
	response: updateInquiryStatusResponseSchema,
} as const;

/**
 * PATCH /committee/inquiries/:inquiryId/reopen
 * 再オープン（RESOLVED → IN_PROGRESS）（担当者 or 管理者のみ）
 *
 * bodyを持たないPATCHのため、BodyEndpoint/NoBodyEndpoint ではなく Endpoint を直接使用
 */
export const reopenCommitteeInquiryEndpoint: Endpoint<
	"PATCH",
	"/committee/inquiries/:inquiryId/reopen",
	typeof inquiryIdPathParamsSchema,
	undefined,
	undefined,
	typeof reopenInquiryResponseSchema
> = {
	method: "PATCH",
	path: "/committee/inquiries/:inquiryId/reopen",
	pathParams: inquiryIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: reopenInquiryResponseSchema,
} as const;

/**
 * POST /committee/inquiries/:inquiryId/assignees
 * 担当者を追加（担当者 or 管理者のみ）
 * 実委側担当者追加時に UNASSIGNED → IN_PROGRESS 自動遷移
 */
export const addCommitteeInquiryAssigneeEndpoint: BodyEndpoint<
	"POST",
	"/committee/inquiries/:inquiryId/assignees",
	typeof inquiryIdPathParamsSchema,
	undefined,
	typeof addInquiryAssigneeRequestSchema,
	typeof addInquiryAssigneeResponseSchema
> = {
	method: "POST",
	path: "/committee/inquiries/:inquiryId/assignees",
	pathParams: inquiryIdPathParamsSchema,
	query: undefined,
	request: addInquiryAssigneeRequestSchema,
	response: addInquiryAssigneeResponseSchema,
} as const;

/**
 * DELETE /committee/inquiries/:inquiryId/assignees/:assigneeId
 * 担当者を削除（担当者 or 管理者のみ、作成者は削除不可）
 */
export const removeCommitteeInquiryAssigneeEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/inquiries/:inquiryId/assignees/:assigneeId",
	typeof committeeInquiryAssigneeIdPathParamsSchema,
	undefined,
	typeof removeInquiryAssigneeResponseSchema
> = {
	method: "DELETE",
	path: "/committee/inquiries/:inquiryId/assignees/:assigneeId",
	pathParams: committeeInquiryAssigneeIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: removeInquiryAssigneeResponseSchema,
} as const;

/**
 * PUT /committee/inquiries/:inquiryId/viewers
 * 閲覧者を設定（担当者 or 管理者のみ）
 * 既存の閲覧者を全削除して新規作成
 */
export const updateCommitteeInquiryViewersEndpoint: BodyEndpoint<
	"PUT",
	"/committee/inquiries/:inquiryId/viewers",
	typeof inquiryIdPathParamsSchema,
	undefined,
	typeof updateInquiryViewersRequestSchema,
	typeof updateInquiryViewersResponseSchema
> = {
	method: "PUT",
	path: "/committee/inquiries/:inquiryId/viewers",
	pathParams: inquiryIdPathParamsSchema,
	query: undefined,
	request: updateInquiryViewersRequestSchema,
	response: updateInquiryViewersResponseSchema,
} as const;

/**
 * POST /committee/inquiries/:inquiryId/comments/:commentId/publish
 * 下書きコメントを正式送信に変換（作成者のみ）
 */
export const publishDraftCommentEndpoint: Endpoint<
	"POST",
	"/committee/inquiries/:inquiryId/comments/:commentId/publish",
	typeof inquiryCommentIdPathParamsSchema,
	undefined,
	undefined,
	typeof publishDraftCommentResponseSchema
> = {
	method: "POST",
	path: "/committee/inquiries/:inquiryId/comments/:commentId/publish",
	pathParams: inquiryCommentIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: publishDraftCommentResponseSchema,
} as const;

/**
 * PATCH /committee/inquiries/:inquiryId/comments/:commentId
 * 下書きコメントを更新（作成者のみ）
 */
export const updateCommitteeDraftCommentEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/inquiries/:inquiryId/comments/:commentId",
	typeof inquiryCommentIdPathParamsSchema,
	undefined,
	typeof updateDraftCommentRequestSchema,
	typeof updateDraftCommentResponseSchema
> = {
	method: "PATCH",
	path: "/committee/inquiries/:inquiryId/comments/:commentId",
	pathParams: inquiryCommentIdPathParamsSchema,
	query: undefined,
	request: updateDraftCommentRequestSchema,
	response: updateDraftCommentResponseSchema,
} as const;

/**
 * DELETE /committee/inquiries/:inquiryId/comments/:commentId
 * コメントを削除（下書きの場合は作成者のみ、通常コメントは管理者または作成者）
 */
export const deleteCommitteeInquiryCommentEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/inquiries/:inquiryId/comments/:commentId",
	typeof inquiryCommentIdPathParamsSchema,
	undefined,
	typeof deleteInquiryCommentResponseSchema
> = {
	method: "DELETE",
	path: "/committee/inquiries/:inquiryId/comments/:commentId",
	pathParams: inquiryCommentIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: deleteInquiryCommentResponseSchema,
} as const;

/**
 * PATCH /committee/inquiries/:inquiryId
 * 下書きのお問い合わせを編集（件名・内容のみ、下書き作成者のみ）
 */
export const updateDraftInquiryEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/inquiries/:inquiryId",
	typeof inquiryIdPathParamsSchema,
	undefined,
	typeof updateDraftInquiryRequestSchema,
	typeof updateDraftInquiryResponseSchema
> = {
	method: "PATCH",
	path: "/committee/inquiries/:inquiryId",
	pathParams: inquiryIdPathParamsSchema,
	query: undefined,
	request: updateDraftInquiryRequestSchema,
	response: updateDraftInquiryResponseSchema,
} as const;

/**
 * POST /committee/inquiries/:inquiryId/publish
 * 下書きのお問い合わせを送信（下書き作成者のみ）
 */
export const publishDraftInquiryEndpoint: Endpoint<
	"POST",
	"/committee/inquiries/:inquiryId/publish",
	typeof inquiryIdPathParamsSchema,
	undefined,
	undefined,
	typeof publishDraftInquiryResponseSchema
> = {
	method: "POST",
	path: "/committee/inquiries/:inquiryId/publish",
	pathParams: inquiryIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: publishDraftInquiryResponseSchema,
} as const;

/**
 * DELETE /committee/inquiries/:inquiryId
 * 下書きのお問い合わせを削除（下書き作成者のみ）
 */
export const deleteInquiryEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/inquiries/:inquiryId",
	typeof inquiryIdPathParamsSchema,
	undefined,
	typeof deleteInquiryResponseSchema
> = {
	method: "DELETE",
	path: "/committee/inquiries/:inquiryId",
	pathParams: inquiryIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: deleteInquiryResponseSchema,
} as const;
