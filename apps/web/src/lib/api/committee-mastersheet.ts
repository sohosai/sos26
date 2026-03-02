import {
	type GetMastersheetDataResponse,
	getMastersheetDataEndpoint,
	type UpsertMastersheetCellRequest,
	type UpsertMastersheetCellResponse,
	type UpsertMastersheetOverrideRequest,
	type UpsertMastersheetOverrideResponse,
	upsertMastersheetCellEndpoint,
	upsertMastersheetOverrideEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi } from "./core";

/**
 * GET /committee/mastersheet/data
 * 全企画 × 権限フィルタ後の全カラムを一括取得
 */
export async function getMastersheetData(): Promise<GetMastersheetDataResponse> {
	return callGetApi(getMastersheetDataEndpoint);
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
