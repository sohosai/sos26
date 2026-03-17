import {
	type AddInquiryAssigneeRequest,
	type AddInquiryAssigneeResponse,
	type AddInquiryCommentRequest,
	type AddInquiryCommentResponse,
	addCommitteeInquiryAssigneeEndpoint,
	addCommitteeInquiryCommentEndpoint,
	type CreateCommitteeInquiryRequest,
	type CreateCommitteeInquiryResponse,
	createCommitteeInquiryEndpoint,
	type DeleteInquiryCommentResponse,
	type DeleteInquiryResponse,
	deleteCommitteeInquiryCommentEndpoint,
	deleteInquiryEndpoint,
	type GetCommitteeInquiryResponse,
	getCommitteeInquiryEndpoint,
	type ListCommitteeInquiriesResponse,
	listCommitteeInquiriesEndpoint,
	type PublishDraftCommentResponse,
	type PublishDraftInquiryResponse,
	publishDraftCommentEndpoint,
	publishDraftInquiryEndpoint,
	type RemoveInquiryAssigneeResponse,
	type ReopenInquiryResponse,
	removeCommitteeInquiryAssigneeEndpoint,
	reopenCommitteeInquiryEndpoint,
	type UpdateDraftCommentRequest,
	type UpdateDraftCommentResponse,
	type UpdateDraftInquiryRequest,
	type UpdateDraftInquiryResponse,
	type UpdateInquiryStatusRequest,
	type UpdateInquiryStatusResponse,
	type UpdateInquiryViewersRequest,
	type UpdateInquiryViewersResponse,
	updateCommitteeDraftCommentEndpoint,
	updateCommitteeInquiryStatusEndpoint,
	updateCommitteeInquiryViewersEndpoint,
	updateDraftInquiryEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi, callNoBodyApi } from "./core";

/**
 * GET /committee/inquiries
 * 実委側お問い合わせ一覧
 */
export async function listCommitteeInquiries(): Promise<ListCommitteeInquiriesResponse> {
	return callGetApi(listCommitteeInquiriesEndpoint);
}

/**
 * GET /committee/inquiries/:inquiryId
 * 実委側お問い合わせ詳細
 */
export async function getCommitteeInquiry(
	inquiryId: string
): Promise<GetCommitteeInquiryResponse> {
	return callGetApi(getCommitteeInquiryEndpoint, {
		pathParams: { inquiryId },
	});
}

/**
 * POST /committee/inquiries
 * 実委側からお問い合わせを作成
 */
export async function createCommitteeInquiry(
	body: CreateCommitteeInquiryRequest
): Promise<CreateCommitteeInquiryResponse> {
	return callBodyApi(createCommitteeInquiryEndpoint, body);
}

/**
 * POST /committee/inquiries/:inquiryId/comments
 * 実委側からコメントを追加
 */
export async function addCommitteeInquiryComment(
	inquiryId: string,
	body: AddInquiryCommentRequest
): Promise<AddInquiryCommentResponse> {
	return callBodyApi(addCommitteeInquiryCommentEndpoint, body, {
		pathParams: { inquiryId },
	});
}

/**
 * PATCH /committee/inquiries/:inquiryId/status
 * ステータスを解決済みに変更
 */
export async function updateCommitteeInquiryStatus(
	inquiryId: string,
	body: UpdateInquiryStatusRequest
): Promise<UpdateInquiryStatusResponse> {
	return callBodyApi(updateCommitteeInquiryStatusEndpoint, body, {
		pathParams: { inquiryId },
	});
}

/**
 * PATCH /committee/inquiries/:inquiryId/reopen
 * 再オープン
 */
export async function reopenCommitteeInquiry(
	inquiryId: string
): Promise<ReopenInquiryResponse> {
	return callNoBodyApi(reopenCommitteeInquiryEndpoint, {
		pathParams: { inquiryId },
	});
}

/**
 * POST /committee/inquiries/:inquiryId/assignees
 * 担当者を追加
 */
export async function addCommitteeInquiryAssignee(
	inquiryId: string,
	body: AddInquiryAssigneeRequest
): Promise<AddInquiryAssigneeResponse> {
	return callBodyApi(addCommitteeInquiryAssigneeEndpoint, body, {
		pathParams: { inquiryId },
	});
}

/**
 * DELETE /committee/inquiries/:inquiryId/assignees/:assigneeId
 * 担当者を削除
 */
export async function removeCommitteeInquiryAssignee(
	inquiryId: string,
	assigneeId: string
): Promise<RemoveInquiryAssigneeResponse> {
	return callNoBodyApi(removeCommitteeInquiryAssigneeEndpoint, {
		pathParams: { inquiryId, assigneeId },
	});
}

/**
 * PUT /committee/inquiries/:inquiryId/viewers
 * 閲覧者を設定
 */
export async function updateCommitteeInquiryViewers(
	inquiryId: string,
	body: UpdateInquiryViewersRequest
): Promise<UpdateInquiryViewersResponse> {
	return callBodyApi(updateCommitteeInquiryViewersEndpoint, body, {
		pathParams: { inquiryId },
	});
}

/**
 * POST /committee/inquiries/:inquiryId/comments/:commentId/publish
 * 下書きコメントを正式送信
 */
export async function publishDraftComment(
	inquiryId: string,
	commentId: string
): Promise<PublishDraftCommentResponse> {
	return callNoBodyApi(publishDraftCommentEndpoint, {
		pathParams: { inquiryId, commentId },
	});
}

/**
 * PATCH /committee/inquiries/:inquiryId/comments/:commentId
 * 下書きコメントを更新
 */
export async function updateCommitteeDraftComment(
	inquiryId: string,
	commentId: string,
	body: UpdateDraftCommentRequest
): Promise<UpdateDraftCommentResponse> {
	return callBodyApi(updateCommitteeDraftCommentEndpoint, body, {
		pathParams: { inquiryId, commentId },
	});
}

/**
 * DELETE /committee/inquiries/:inquiryId/comments/:commentId
 * コメントを削除
 */
export async function deleteCommitteeInquiryComment(
	inquiryId: string,
	commentId: string
): Promise<DeleteInquiryCommentResponse> {
	return callNoBodyApi(deleteCommitteeInquiryCommentEndpoint, {
		pathParams: { inquiryId, commentId },
	});
}

/**
 * PATCH /committee/inquiries/:inquiryId
 * 下書きお問い合わせを更新
 */
export async function updateDraftInquiry(
	inquiryId: string,
	body: UpdateDraftInquiryRequest
): Promise<UpdateDraftInquiryResponse> {
	return callBodyApi(updateDraftInquiryEndpoint, body, {
		pathParams: { inquiryId },
	});
}

/**
 * POST /committee/inquiries/:inquiryId/publish
 * 下書きお問い合わせを正式送信
 */
export async function publishDraftInquiry(
	inquiryId: string
): Promise<PublishDraftInquiryResponse> {
	return callNoBodyApi(publishDraftInquiryEndpoint, {
		pathParams: { inquiryId },
	});
}

/**
 * DELETE /committee/inquiries/:inquiryId
 * 下書きお問い合わせを削除
 */
export async function deleteDraftInquiry(
	inquiryId: string
): Promise<DeleteInquiryResponse> {
	return callNoBodyApi(deleteInquiryEndpoint, {
		pathParams: { inquiryId },
	});
}
