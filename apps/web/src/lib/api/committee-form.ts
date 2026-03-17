import {
	type AddFormAttachmentRequest,
	type AddFormAttachmentResponse,
	type AddFormCollaboratorRequest,
	type AddFormCollaboratorResponse,
	addFormAttachmentEndpoint,
	addFormCollaboratorEndpoint,
	type CreateFormRequest,
	type CreateFormResponse,
	createFormEndpoint,
	type DeleteFormResponse,
	deleteFormEndpoint,
	type GetFormDetailResponse,
	type GetFormResponseResponse,
	getFormDetailEndpoint,
	getFormResponseEndpoint,
	type ListFormResponsesResponse,
	type ListMyFormsResponse,
	listFormResponsesEndpoint,
	listMyFormsEndpoint,
	type RemoveFormAttachmentResponse,
	type RemoveFormCollaboratorResponse,
	type RequestFormAuthorizationRequest,
	type RequestFormAuthorizationResponse,
	removeFormAttachmentEndpoint,
	removeFormCollaboratorEndpoint,
	requestFormAuthorizationEndpoint,
	type UpdateFormAuthorizationResponse,
	type UpdateFormDetailRequest,
	type UpdateFormDetailResponse,
	type UpdateFormViewersRequest,
	type UpdateFormViewersResponse,
	updateFormAuthorizationEndpoint,
	updateFormDetailEndpoint,
	updateFormViewersEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi, callNoBodyApi } from "./core";

// ─────────────────────────────────────────────────────────────
// 申請基本操作
// ─────────────────────────────────────────────────────────────

/**
 * POST /form/create
 * 申請を作成
 */
export async function createForm(
	body: CreateFormRequest
): Promise<CreateFormResponse> {
	return callBodyApi(createFormEndpoint, body);
}

/**
 * GET /form/list
 * 自分が作成・共同編集している申請一覧を取得
 */
export async function listMyForms(): Promise<ListMyFormsResponse> {
	return callGetApi(listMyFormsEndpoint);
}

/**
 * GET /form/:formId/detail
 * 申請の詳細を取得（項目含む）
 */
export async function getFormDetail(
	formId: string
): Promise<GetFormDetailResponse> {
	return callGetApi(getFormDetailEndpoint, {
		pathParams: { formId },
	});
}

/**
 * PATCH /form/:formId/detail
 * 申請のタイトル・説明を更新
 */
export async function updateFormDetail(
	formId: string,
	body: UpdateFormDetailRequest
): Promise<UpdateFormDetailResponse> {
	return callBodyApi(updateFormDetailEndpoint, body, {
		pathParams: { formId },
	});
}

/**
 * DELETE /form/:formId
 * 申請を論理削除
 */
export async function deleteForm(formId: string): Promise<DeleteFormResponse> {
	return callNoBodyApi(deleteFormEndpoint, {
		pathParams: { formId },
	});
}

// ─────────────────────────────────────────────────────────────
// 共同編集者
// ─────────────────────────────────────────────────────────────

/**
 * POST /form/:formId/collaborators/:userId
 * 共同編集者を追加
 */
export async function addFormCollaborator(
	formId: string,
	userId: string,
	body: AddFormCollaboratorRequest
): Promise<AddFormCollaboratorResponse> {
	return callBodyApi(addFormCollaboratorEndpoint, body, {
		pathParams: { formId, userId },
	});
}

/**
 * DELETE /form/:formId/collaborators/:userId
 * 共同編集者を削除
 */
export async function removeFormCollaborator(
	formId: string,
	userId: string
): Promise<RemoveFormCollaboratorResponse> {
	return callNoBodyApi(removeFormCollaboratorEndpoint, {
		pathParams: { formId, userId },
	});
}

/**
 * POST /committee/forms/:formId/attachments
 * 添付ファイルを追加
 */
export async function addFormAttachments(
	formId: string,
	body: AddFormAttachmentRequest
): Promise<AddFormAttachmentResponse> {
	return callBodyApi(addFormAttachmentEndpoint, body, {
		pathParams: { formId },
	});
}

/**
 * DELETE /committee/forms/:formId/attachments/:attachmentId
 * 添付ファイルを削除
 */
export async function removeFormAttachment(
	formId: string,
	attachmentId: string
): Promise<RemoveFormAttachmentResponse> {
	return callNoBodyApi(removeFormAttachmentEndpoint, {
		pathParams: { formId, attachmentId },
	});
}

// ─────────────────────────────────────────────────────────────
// 承認フロー
// ─────────────────────────────────────────────────────────────

/**
 * POST /form/:formId/authorizations
 * 承認依頼をリクエスト
 */
export async function requestFormAuthorization(
	formId: string,
	body: RequestFormAuthorizationRequest
): Promise<RequestFormAuthorizationResponse> {
	return callBodyApi(requestFormAuthorizationEndpoint, body, {
		pathParams: { formId },
	});
}

/**
 * PATCH /form/:formId/authorizations/:authorizationId/approve
 * 承認依頼を承認
 */
export async function approveFormAuthorization(
	formId: string,
	authorizationId: string
): Promise<UpdateFormAuthorizationResponse> {
	return callBodyApi(
		updateFormAuthorizationEndpoint,
		{ status: "APPROVED" },
		{
			pathParams: { formId, authorizationId },
		}
	);
}

/**
 * PATCH /form/:formId/authorizations/:authorizationId/reject
 * 承認依頼を却下
 */
export async function rejectFormAuthorization(
	formId: string,
	authorizationId: string
): Promise<UpdateFormAuthorizationResponse> {
	return callBodyApi(
		updateFormAuthorizationEndpoint,
		{ status: "REJECTED" },
		{
			pathParams: { formId, authorizationId },
		}
	);
}

/**
 * GET /form/:formId/responses
 * 回答一覧（owner または共同編集者のみ）
 */
export async function listFormResponses(
	formId: string
): Promise<ListFormResponsesResponse> {
	return callGetApi(listFormResponsesEndpoint, { pathParams: { formId } });
}

/**
 * PUT /form/:formId/viewers
 * 閲覧者を設定
 */
export async function updateFormViewers(
	formId: string,
	body: UpdateFormViewersRequest
): Promise<UpdateFormViewersResponse> {
	return callBodyApi(updateFormViewersEndpoint, body, {
		pathParams: { formId },
	});
}

/**
 * GET /form/:formId/responses/:responseId
 * 回答詳細（owner または共同編集者のみ）
 */
export async function getFormResponse(
	formId: string,
	responseId: string
): Promise<GetFormResponseResponse> {
	return callGetApi(getFormResponseEndpoint, {
		pathParams: { formId, responseId },
	});
}
