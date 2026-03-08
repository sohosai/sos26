import {
	createMastersheetAccessRequestResponseSchema,
	createMastersheetColumnRequestSchema,
	createMastersheetColumnResponseSchema,
	createMastersheetViewRequestSchema,
	createMastersheetViewResponseSchema,
	deleteMastersheetColumnResponseSchema,
	deleteMastersheetViewResponseSchema,
	discoverMastersheetColumnsResponseSchema,
	editFormItemCellRequestSchema,
	editFormItemCellResponseSchema,
	getMastersheetDataResponseSchema,
	getMastersheetHistoryResponseSchema,
	listMastersheetAccessRequestsResponseSchema,
	listMastersheetViewsResponseSchema,
	mastersheetAccessRequestIdPathParamsSchema,
	mastersheetColumnIdPathParamsSchema,
	mastersheetColumnProjectPathParamsSchema,
	mastersheetViewIdPathParamsSchema,
	updateMastersheetAccessRequestRequestSchema,
	updateMastersheetAccessRequestResponseSchema,
	updateMastersheetColumnRequestSchema,
	updateMastersheetColumnResponseSchema,
	updateMastersheetViewRequestSchema,
	updateMastersheetViewResponseSchema,
	upsertMastersheetCellRequestSchema,
	upsertMastersheetCellResponseSchema,
} from "../schemas/mastersheet";
import type { BodyEndpoint, GetEndpoint, NoBodyEndpoint } from "./types";

// ─────────────────────────────────────────────────────────────
// データ取得
// ─────────────────────────────────────────────────────────────

/**
 * GET /committee/mastersheet/data
 * 全企画 × 権限フィルタ後の全カラムを一括取得
 */
export const getMastersheetDataEndpoint: GetEndpoint<
	"/committee/mastersheet/data",
	undefined,
	undefined,
	typeof getMastersheetDataResponseSchema
> = {
	method: "GET",
	path: "/committee/mastersheet/data",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: getMastersheetDataResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// カラム管理
// ─────────────────────────────────────────────────────────────

/**
 * POST /committee/mastersheet/columns
 * カラムを追加（FORM_ITEM / CUSTOM）
 *
 * - FORM_ITEM: 対象フォームへのアクセス権必須
 */
export const createMastersheetColumnEndpoint: BodyEndpoint<
	"POST",
	"/committee/mastersheet/columns",
	undefined,
	undefined,
	typeof createMastersheetColumnRequestSchema,
	typeof createMastersheetColumnResponseSchema
> = {
	method: "POST",
	path: "/committee/mastersheet/columns",
	pathParams: undefined,
	query: undefined,
	request: createMastersheetColumnRequestSchema,
	response: createMastersheetColumnResponseSchema,
} as const;

/**
 * PATCH /committee/mastersheet/columns/:columnId
 * カラムのメタデータを更新
 *
 * - 作成者のみ
 */
export const updateMastersheetColumnEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/mastersheet/columns/:columnId",
	typeof mastersheetColumnIdPathParamsSchema,
	undefined,
	typeof updateMastersheetColumnRequestSchema,
	typeof updateMastersheetColumnResponseSchema
> = {
	method: "PATCH",
	path: "/committee/mastersheet/columns/:columnId",
	pathParams: mastersheetColumnIdPathParamsSchema,
	query: undefined,
	request: updateMastersheetColumnRequestSchema,
	response: updateMastersheetColumnResponseSchema,
} as const;

/**
 * DELETE /committee/mastersheet/columns/:columnId
 * カラムを削除（関連データはカスケード削除）
 *
 * - 作成者のみ
 */
export const deleteMastersheetColumnEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/mastersheet/columns/:columnId",
	typeof mastersheetColumnIdPathParamsSchema,
	undefined,
	typeof deleteMastersheetColumnResponseSchema
> = {
	method: "DELETE",
	path: "/committee/mastersheet/columns/:columnId",
	pathParams: mastersheetColumnIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: deleteMastersheetColumnResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// セル・オーバーライド編集
// ─────────────────────────────────────────────────────────────

/**
 * PUT /committee/mastersheet/cells/:columnId/:projectId
 * 自由追加カラムのセル値を更新
 */
export const upsertMastersheetCellEndpoint: BodyEndpoint<
	"PUT",
	"/committee/mastersheet/cells/:columnId/:projectId",
	typeof mastersheetColumnProjectPathParamsSchema,
	undefined,
	typeof upsertMastersheetCellRequestSchema,
	typeof upsertMastersheetCellResponseSchema
> = {
	method: "PUT",
	path: "/committee/mastersheet/cells/:columnId/:projectId",
	pathParams: mastersheetColumnProjectPathParamsSchema,
	query: undefined,
	request: upsertMastersheetCellRequestSchema,
	response: upsertMastersheetCellResponseSchema,
} as const;

/**
 * PUT /committee/mastersheet/edits/:columnId/:projectId
 * フォーム由来カラムの値を編集（FormItemEditHistory に COMMITTEE_EDIT を追加）
 */
export const editFormItemCellEndpoint: BodyEndpoint<
	"PUT",
	"/committee/mastersheet/edits/:columnId/:projectId",
	typeof mastersheetColumnProjectPathParamsSchema,
	undefined,
	typeof editFormItemCellRequestSchema,
	typeof editFormItemCellResponseSchema
> = {
	method: "PUT",
	path: "/committee/mastersheet/edits/:columnId/:projectId",
	pathParams: mastersheetColumnProjectPathParamsSchema,
	query: undefined,
	request: editFormItemCellRequestSchema,
	response: editFormItemCellResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// 編集履歴
// ─────────────────────────────────────────────────────────────

/**
 * GET /committee/mastersheet/columns/:columnId/history/:projectId
 * 編集履歴を降順で取得
 */
export const getMastersheetHistoryEndpoint: GetEndpoint<
	"/committee/mastersheet/columns/:columnId/history/:projectId",
	typeof mastersheetColumnProjectPathParamsSchema,
	undefined,
	typeof getMastersheetHistoryResponseSchema
> = {
	method: "GET",
	path: "/committee/mastersheet/columns/:columnId/history/:projectId",
	pathParams: mastersheetColumnProjectPathParamsSchema,
	query: undefined,
	request: undefined,
	response: getMastersheetHistoryResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// カラム発見・アクセス申請
// ─────────────────────────────────────────────────────────────

/**
 * GET /committee/mastersheet/columns/discover
 * PUBLIC カラム全件 + 自分の PRIVATE カラム一覧
 * 権限外は name/createdBy のみ返す
 */
export const discoverMastersheetColumnsEndpoint: GetEndpoint<
	"/committee/mastersheet/columns/discover",
	undefined,
	undefined,
	typeof discoverMastersheetColumnsResponseSchema
> = {
	method: "GET",
	path: "/committee/mastersheet/columns/discover",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: discoverMastersheetColumnsResponseSchema,
} as const;

/**
 * POST /committee/mastersheet/columns/:columnId/access-request
 * アクセス申請を送信
 * PENDING 重複時は 409
 */
export const createMastersheetAccessRequestEndpoint: NoBodyEndpoint<
	// biome-ignore lint/suspicious/noExplicitAny: POST with no body
	any,
	"/committee/mastersheet/columns/:columnId/access-request",
	typeof mastersheetColumnIdPathParamsSchema,
	undefined,
	typeof createMastersheetAccessRequestResponseSchema
> = {
	method: "POST",
	path: "/committee/mastersheet/columns/:columnId/access-request",
	pathParams: mastersheetColumnIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: createMastersheetAccessRequestResponseSchema,
} as const;

/**
 * GET /committee/mastersheet/access-requests
 * 自分が承認権限を持つ PENDING 申請一覧
 *
 * - CUSTOM: カラム作成者
 * - FORM_ITEM: フォームオーナー
 */
export const listMastersheetAccessRequestsEndpoint: GetEndpoint<
	"/committee/mastersheet/access-requests",
	undefined,
	undefined,
	typeof listMastersheetAccessRequestsResponseSchema
> = {
	method: "GET",
	path: "/committee/mastersheet/access-requests",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listMastersheetAccessRequestsResponseSchema,
} as const;

/**
 * PATCH /committee/mastersheet/access-requests/:requestId
 * アクセス申請を承認・却下
 *
 * - CUSTOM: カラム作成者のみ
 * - FORM_ITEM: フォームオーナーのみ
 * - APPROVED 時は種別に応じて MastersheetColumnViewer または FormCollaborator を作成
 */
export const updateMastersheetAccessRequestEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/mastersheet/access-requests/:requestId",
	typeof mastersheetAccessRequestIdPathParamsSchema,
	undefined,
	typeof updateMastersheetAccessRequestRequestSchema,
	typeof updateMastersheetAccessRequestResponseSchema
> = {
	method: "PATCH",
	path: "/committee/mastersheet/access-requests/:requestId",
	pathParams: mastersheetAccessRequestIdPathParamsSchema,
	query: undefined,
	request: updateMastersheetAccessRequestRequestSchema,
	response: updateMastersheetAccessRequestResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// ビュー管理
// ─────────────────────────────────────────────────────────────

/**
 * GET /committee/mastersheet/views
 * 自分が保存したビュー一覧
 */
export const listMastersheetViewsEndpoint: GetEndpoint<
	"/committee/mastersheet/views",
	undefined,
	undefined,
	typeof listMastersheetViewsResponseSchema
> = {
	method: "GET",
	path: "/committee/mastersheet/views",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listMastersheetViewsResponseSchema,
} as const;

/**
 * POST /committee/mastersheet/views
 * ビューを保存
 */
export const createMastersheetViewEndpoint: BodyEndpoint<
	"POST",
	"/committee/mastersheet/views",
	undefined,
	undefined,
	typeof createMastersheetViewRequestSchema,
	typeof createMastersheetViewResponseSchema
> = {
	method: "POST",
	path: "/committee/mastersheet/views",
	pathParams: undefined,
	query: undefined,
	request: createMastersheetViewRequestSchema,
	response: createMastersheetViewResponseSchema,
} as const;

/**
 * PATCH /committee/mastersheet/views/:viewId
 * ビューの state を更新（自分のビューのみ）
 */
export const updateMastersheetViewEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/mastersheet/views/:viewId",
	typeof mastersheetViewIdPathParamsSchema,
	undefined,
	typeof updateMastersheetViewRequestSchema,
	typeof updateMastersheetViewResponseSchema
> = {
	method: "PATCH",
	path: "/committee/mastersheet/views/:viewId",
	pathParams: mastersheetViewIdPathParamsSchema,
	query: undefined,
	request: updateMastersheetViewRequestSchema,
	response: updateMastersheetViewResponseSchema,
} as const;

/**
 * DELETE /committee/mastersheet/views/:viewId
 * ビューを削除（自分のビューのみ）
 */
export const deleteMastersheetViewEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/mastersheet/views/:viewId",
	typeof mastersheetViewIdPathParamsSchema,
	undefined,
	typeof deleteMastersheetViewResponseSchema
> = {
	method: "DELETE",
	path: "/committee/mastersheet/views/:viewId",
	pathParams: mastersheetViewIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: deleteMastersheetViewResponseSchema,
} as const;
