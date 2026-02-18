import {
	type GetProjectNoticeResponse,
	getProjectNoticeEndpoint,
	type ListProjectNoticesResponse,
	listProjectNoticesEndpoint,
	type ReadProjectNoticeResponse,
	readProjectNoticeEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi } from "./core";

/**
 * GET /project/:projectId/notices
 * 配信済みお知らせ一覧
 */
export async function listProjectNotices(
	projectId: string
): Promise<ListProjectNoticesResponse> {
	return callGetApi(listProjectNoticesEndpoint, {
		pathParams: { projectId },
	});
}

/**
 * GET /project/:projectId/notices/:noticeId
 * お知らせ詳細
 */
export async function getProjectNotice(
	projectId: string,
	noticeId: string
): Promise<GetProjectNoticeResponse> {
	return callGetApi(getProjectNoticeEndpoint, {
		pathParams: { projectId, noticeId },
	});
}

/**
 * POST /project/:projectId/notices/:noticeId/read
 * お知らせを既読にする
 */
export async function readProjectNotice(
	projectId: string,
	noticeId: string
): Promise<ReadProjectNoticeResponse> {
	return callBodyApi(
		readProjectNoticeEndpoint,
		{ success: true },
		{
			pathParams: { projectId, noticeId },
		}
	);
}
