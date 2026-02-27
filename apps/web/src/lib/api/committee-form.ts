import {
	type AddFormCollaboratorRequest,
	type AddFormCollaboratorResponse,
	type ApproveFormAuthorizationResponse,
	addFormCollaboratorEndpoint,
	approveFormAuthorizationEndpoint,
	type CreateFormRequest,
	type CreateFormResponse,
	createFormEndpoint,
	type DeleteFormResponse,
	deleteFormEndpoint,
	type GetFormDetailResponse,
	getFormDetailEndpoint,
	type ListFormResponsesResponse,
	type ListMyFormsResponse,
	listFormResponsesEndpoint,
	listMyFormsEndpoint,
	type RejectFormAuthorizationResponse,
	type RemoveFormCollaboratorResponse,
	type RequestFormAuthorizationRequest,
	type RequestFormAuthorizationResponse,
	rejectFormAuthorizationEndpoint,
	removeFormCollaboratorEndpoint,
	requestFormAuthorizationEndpoint,
	type UpdateFormDetailRequest,
	type UpdateFormDetailResponse,
	updateFormDetailEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi, callNoBodyApi } from "./core";

// ─────────────────────────────────────────────────────────────
// フォーム基本操作
// ─────────────────────────────────────────────────────────────

/**
 * POST /form/create
 * フォームを作成
 */
export async function createForm(
	body: CreateFormRequest
): Promise<CreateFormResponse> {
	return callBodyApi(createFormEndpoint, body);
}

/**
 * GET /form/list
 * 自分が作成・共同編集しているフォーム一覧を取得
 */
export async function listMyForms(): Promise<ListMyFormsResponse> {
	return callGetApi(listMyFormsEndpoint);
}

/**
 * GET /form/:formId/detail
 * フォームの詳細を取得（項目含む）
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
 * フォームのタイトル・説明を更新
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
 * フォームを論理削除
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

// ─────────────────────────────────────────────────────────────
// 承認フロー
// ─────────────────────────────────────────────────────────────

/**
 * POST /form/:formId/authorizations
 * 配信承認をリクエスト
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
 * POST /form/:formId/authorizations/:authorizationId/approve
 * 配信承認を承認
 */
export async function approveFormAuthorization(
	formId: string,
	authorizationId: string
): Promise<ApproveFormAuthorizationResponse> {
	return callBodyApi(approveFormAuthorizationEndpoint, undefined, {
		pathParams: { formId, authorizationId },
	});
}

/**
 * POST /form/:formId/authorizations/:authorizationId/reject
 * 配信承認を却下
 */
export async function rejectFormAuthorization(
	formId: string,
	authorizationId: string
): Promise<RejectFormAuthorizationResponse> {
	return callBodyApi(rejectFormAuthorizationEndpoint, undefined, {
		pathParams: { formId, authorizationId },
	});
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
