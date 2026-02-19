import {
	type AddCollaboratorRequest,
	type AddCollaboratorResponse,
	addCollaboratorEndpoint,
	type CreateNoticeAuthorizationRequest,
	type CreateNoticeAuthorizationResponse,
	type CreateNoticeRequest,
	type CreateNoticeResponse,
	createNoticeAuthorizationEndpoint,
	createNoticeEndpoint,
	type DeleteNoticeResponse,
	deleteNoticeEndpoint,
	type GetNoticeResponse,
	getNoticeEndpoint,
	type ListNoticesResponse,
	listNoticesEndpoint,
	type RemoveCollaboratorResponse,
	removeCollaboratorEndpoint,
	type UpdateNoticeAuthorizationRequest,
	type UpdateNoticeAuthorizationResponse,
	type UpdateNoticeRequest,
	type UpdateNoticeResponse,
	updateNoticeAuthorizationEndpoint,
	updateNoticeEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi, callNoBodyApi } from "./core";

/**
 * POST /committee/notices
 * お知らせを作成
 */
export async function createNotice(
	body: CreateNoticeRequest
): Promise<CreateNoticeResponse> {
	return callBodyApi(createNoticeEndpoint, body);
}

/**
 * GET /committee/notices
 * お知らせ一覧を取得
 */
export async function listNotices(): Promise<ListNoticesResponse> {
	return callGetApi(listNoticesEndpoint);
}

/**
 * GET /committee/notices/:noticeId
 * お知らせ詳細を取得
 */
export async function getNotice(noticeId: string): Promise<GetNoticeResponse> {
	return callGetApi(getNoticeEndpoint, {
		pathParams: { noticeId },
	});
}

/**
 * PATCH /committee/notices/:noticeId
 * お知らせを編集
 */
export async function updateNotice(
	noticeId: string,
	body: UpdateNoticeRequest
): Promise<UpdateNoticeResponse> {
	return callBodyApi(updateNoticeEndpoint, body, {
		pathParams: { noticeId },
	});
}

/**
 * DELETE /committee/notices/:noticeId
 * お知らせを削除
 */
export async function deleteNotice(
	noticeId: string
): Promise<DeleteNoticeResponse> {
	return callNoBodyApi(deleteNoticeEndpoint, {
		pathParams: { noticeId },
	});
}

/**
 * POST /committee/notices/:noticeId/collaborators
 * 共同編集者を追加
 */
export async function addCollaborator(
	noticeId: string,
	body: AddCollaboratorRequest
): Promise<AddCollaboratorResponse> {
	return callBodyApi(addCollaboratorEndpoint, body, {
		pathParams: { noticeId },
	});
}

/**
 * DELETE /committee/notices/:noticeId/collaborators/:collaboratorId
 * 共同編集者を削除
 */
export async function removeCollaborator(
	noticeId: string,
	collaboratorId: string
): Promise<RemoveCollaboratorResponse> {
	return callNoBodyApi(removeCollaboratorEndpoint, {
		pathParams: { noticeId, collaboratorId },
	});
}

/**
 * POST /committee/notices/:noticeId/authorizations
 * 配信承認を申請
 */
export async function createNoticeAuthorization(
	noticeId: string,
	body: CreateNoticeAuthorizationRequest
): Promise<CreateNoticeAuthorizationResponse> {
	return callBodyApi(createNoticeAuthorizationEndpoint, body, {
		pathParams: { noticeId },
	});
}

/**
 * PATCH /committee/notices/:noticeId/authorizations/:authorizationId
 * 承認 / 却下
 */
export async function updateNoticeAuthorization(
	noticeId: string,
	authorizationId: string,
	body: UpdateNoticeAuthorizationRequest
): Promise<UpdateNoticeAuthorizationResponse> {
	return callBodyApi(updateNoticeAuthorizationEndpoint, body, {
		pathParams: { noticeId, authorizationId },
	});
}
