import {
	type BatchMastersheetHistoryRequest,
	type BatchMastersheetHistoryResponse,
	batchMastersheetHistoryEndpoint,
	type CreateMastersheetAccessRequestResponse,
	type CreateMastersheetColumnRequest,
	type CreateMastersheetColumnResponse,
	type CreateMastersheetViewRequest,
	type CreateMastersheetViewResponse,
	createMastersheetAccessRequestEndpoint,
	createMastersheetColumnEndpoint,
	createMastersheetViewEndpoint,
	type DeleteMastersheetColumnResponse,
	type DeleteMastersheetViewResponse,
	type DiscoverMastersheetColumnsResponse,
	deleteMastersheetColumnEndpoint,
	deleteMastersheetViewEndpoint,
	discoverMastersheetColumnsEndpoint,
	type EditFormItemCellRequest,
	type EditFormItemCellResponse,
	editFormItemCellEndpoint,
	type GetMastersheetDataResponse,
	getMastersheetDataEndpoint,
	type ListMastersheetAccessRequestsResponse,
	type ListMastersheetViewsResponse,
	listMastersheetAccessRequestsEndpoint,
	listMastersheetViewsEndpoint,
	type UpdateMastersheetAccessRequestRequest,
	type UpdateMastersheetAccessRequestResponse,
	type UpdateMastersheetColumnRequest,
	type UpdateMastersheetColumnResponse,
	type UpdateMastersheetViewRequest,
	type UpdateMastersheetViewResponse,
	type UpsertMastersheetCellRequest,
	type UpsertMastersheetCellResponse,
	updateMastersheetAccessRequestEndpoint,
	updateMastersheetColumnEndpoint,
	updateMastersheetViewEndpoint,
	upsertMastersheetCellEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi, callNoBodyApi } from "./core";

/**
 * GET /committee/mastersheet/data
 * 全企画 × 権限フィルタ後の全カラムを一括取得
 */
export async function getMastersheetData(): Promise<GetMastersheetDataResponse> {
	return callGetApi(getMastersheetDataEndpoint);
}

/**
 * POST /committee/mastersheet/columns
 * カラムを追加（FORM_ITEM / CUSTOM）
 */
export async function createMastersheetColumn(
	body: CreateMastersheetColumnRequest
): Promise<CreateMastersheetColumnResponse> {
	return callBodyApi(createMastersheetColumnEndpoint, body);
}

/**
 * PATCH /committee/mastersheet/columns/:columnId
 * カラムのメタデータを更新
 */
export async function updateMastersheetColumn(
	columnId: string,
	body: UpdateMastersheetColumnRequest
): Promise<UpdateMastersheetColumnResponse> {
	return callBodyApi(updateMastersheetColumnEndpoint, body, {
		pathParams: { columnId },
	});
}

/**
 * DELETE /committee/mastersheet/columns/:columnId
 * カラムを削除（作成者のみ）
 */
export async function deleteMastersheetColumn(
	columnId: string
): Promise<DeleteMastersheetColumnResponse> {
	return callNoBodyApi(deleteMastersheetColumnEndpoint, {
		pathParams: { columnId },
	});
}

/**
 * PUT /committee/mastersheet/cells/:columnId/:projectId
 * 自由追加カラムのセル値を更新
 */
export async function upsertMastersheetCell(
	columnId: string,
	projectId: string,
	body: UpsertMastersheetCellRequest
): Promise<UpsertMastersheetCellResponse> {
	return callBodyApi(upsertMastersheetCellEndpoint, body, {
		pathParams: { columnId, projectId },
	});
}

/**
 * PUT /committee/mastersheet/edits/:columnId/:projectId
 * フォーム由来カラムの値を編集
 */
export async function editFormItemCell(
	columnId: string,
	projectId: string,
	body: EditFormItemCellRequest
): Promise<EditFormItemCellResponse> {
	return callBodyApi(editFormItemCellEndpoint, body, {
		pathParams: { columnId, projectId },
	});
}

/**
 * POST /committee/mastersheet/history
 * 編集履歴をバッチ取得
 */
export async function batchMastersheetHistory(
	cells: BatchMastersheetHistoryRequest["cells"]
): Promise<BatchMastersheetHistoryResponse> {
	return callBodyApi(batchMastersheetHistoryEndpoint, { cells });
}

/**
 * GET /committee/mastersheet/columns/discover
 * PUBLIC カラム全件 + 自分の PRIVATE カラム一覧を取得
 */
export async function discoverMastersheetColumns(): Promise<DiscoverMastersheetColumnsResponse> {
	return callGetApi(discoverMastersheetColumnsEndpoint);
}

/**
 * POST /committee/mastersheet/columns/:columnId/access-request
 * アクセス申請を送信
 */
export async function createMastersheetAccessRequest(
	columnId: string
): Promise<CreateMastersheetAccessRequestResponse> {
	return callNoBodyApi(createMastersheetAccessRequestEndpoint, {
		pathParams: { columnId },
	});
}

/**
 * GET /committee/mastersheet/access-requests
 * 自分が承認権限を持つ PENDING 申請一覧
 */
export async function listMastersheetAccessRequests(): Promise<ListMastersheetAccessRequestsResponse> {
	return callGetApi(listMastersheetAccessRequestsEndpoint);
}

/**
 * PATCH /committee/mastersheet/access-requests/:requestId
 * アクセス申請を承認・却下
 */
export async function updateMastersheetAccessRequest(
	requestId: string,
	status: UpdateMastersheetAccessRequestRequest["status"]
): Promise<UpdateMastersheetAccessRequestResponse> {
	return callBodyApi(
		updateMastersheetAccessRequestEndpoint,
		{ status },
		{
			pathParams: { requestId },
		}
	);
}

/**
 * GET /committee/mastersheet/views
 * 自分が保存したビュー一覧
 */
export async function listMastersheetViews(): Promise<ListMastersheetViewsResponse> {
	return callGetApi(listMastersheetViewsEndpoint);
}

/**
 * POST /committee/mastersheet/views
 * ビューを保存
 */
export async function createMastersheetView(
	body: CreateMastersheetViewRequest
): Promise<CreateMastersheetViewResponse> {
	return callBodyApi(createMastersheetViewEndpoint, body);
}

/**
 * PATCH /committee/mastersheet/views/:viewId
 * ビューの state を更新
 */
export async function updateMastersheetView(
	viewId: string,
	body: UpdateMastersheetViewRequest
): Promise<UpdateMastersheetViewResponse> {
	return callBodyApi(updateMastersheetViewEndpoint, body, {
		pathParams: { viewId },
	});
}

/**
 * DELETE /committee/mastersheet/views/:viewId
 * ビューを削除
 */
export async function deleteMastersheetView(
	viewId: string
): Promise<DeleteMastersheetViewResponse> {
	return callNoBodyApi(deleteMastersheetViewEndpoint, {
		pathParams: { viewId },
	});
}
