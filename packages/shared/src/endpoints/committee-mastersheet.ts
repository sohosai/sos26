import {
	createMastersheetAccessRequestResponseSchema,
	createMastersheetColumnRequestSchema,
	createMastersheetColumnResponseSchema,
	createMastersheetViewRequestSchema,
	createMastersheetViewResponseSchema,
	deleteMastersheetColumnResponseSchema,
	deleteMastersheetOverrideResponseSchema,
	deleteMastersheetViewResponseSchema,
	discoverMastersheetColumnsResponseSchema,
	getMastersheetDataResponseSchema,
	getMastersheetHistoryResponseSchema,
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
	upsertMastersheetOverrideRequestSchema,
	upsertMastersheetOverrideResponseSchema,
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
 * PUT /committee/mastersheet/overrides/:columnId/:projectId
 * フォーム由来カラムの回答をオーバーライド（isStale=false にリセット・編集履歴記録）
 */
export const upsertMastersheetOverrideEndpoint: BodyEndpoint<
	"PUT",
	"/committee/mastersheet/overrides/:columnId/:projectId",
	typeof mastersheetColumnProjectPathParamsSchema,
	undefined,
	typeof upsertMastersheetOverrideRequestSchema,
	typeof upsertMastersheetOverrideResponseSchema
> = {
	method: "PUT",
	path: "/committee/mastersheet/overrides/:columnId/:projectId",
	pathParams: mastersheetColumnProjectPathParamsSchema,
	query: undefined,
	request: upsertMastersheetOverrideRequestSchema,
	response: upsertMastersheetOverrideResponseSchema,
} as const;

/**
 * DELETE /committee/mastersheet/overrides/:columnId/:projectId
 * オーバーライドを削除して元データに戻す（履歴記録）
 */
export const deleteMastersheetOverrideEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/mastersheet/overrides/:columnId/:projectId",
	typeof mastersheetColumnProjectPathParamsSchema,
	undefined,
	typeof deleteMastersheetOverrideResponseSchema
> = {
	method: "DELETE",
	path: "/committee/mastersheet/overrides/:columnId/:projectId",
	pathParams: mastersheetColumnProjectPathParamsSchema,
	query: undefined,
	request: undefined,
	response: deleteMastersheetOverrideResponseSchema,
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
// カラム発見・閲覧申請
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
 * 閲覧申請を送信
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
 * PATCH /committee/mastersheet/access-requests/:requestId
 * 閲覧申請を承認・却下
 *
 * - カラム管理者のみ
 * - APPROVED 時は MastersheetColumnViewer を作成して権限付与
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
