import {
	type CreateMastersheetAccessRequestResponse,
	type CreateMastersheetColumnRequest,
	type CreateMastersheetColumnResponse,
	createMastersheetAccessRequestEndpoint,
	createMastersheetColumnEndpoint,
	type DeleteMastersheetColumnResponse,
	type DiscoverMastersheetColumnsResponse,
	deleteMastersheetColumnEndpoint,
	discoverMastersheetColumnsEndpoint,
	type GetMastersheetDataResponse,
	getMastersheetDataEndpoint,
	type UpdateMastersheetColumnRequest,
	type UpdateMastersheetColumnResponse,
	type UpsertMastersheetCellRequest,
	type UpsertMastersheetCellResponse,
	type UpsertMastersheetOverrideRequest,
	type UpsertMastersheetOverrideResponse,
	updateMastersheetColumnEndpoint,
	upsertMastersheetCellEndpoint,
	upsertMastersheetOverrideEndpoint,
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
 * PUT /committee/mastersheet/overrides/:columnId/:projectId
 * フォーム由来カラムの回答をオーバーライド
 */
export async function upsertMastersheetOverride(
	columnId: string,
	projectId: string,
	body: UpsertMastersheetOverrideRequest
): Promise<UpsertMastersheetOverrideResponse> {
	return callBodyApi(upsertMastersheetOverrideEndpoint, body, {
		pathParams: { columnId, projectId },
	});
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
 * 閲覧申請を送信
 */
export async function createMastersheetAccessRequest(
	columnId: string
): Promise<CreateMastersheetAccessRequestResponse> {
	return callNoBodyApi(createMastersheetAccessRequestEndpoint, {
		pathParams: { columnId },
	});
}
