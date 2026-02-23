import {
	type AddInquiryAssigneeRequest,
	type AddInquiryAssigneeResponse,
	type AddInquiryCommentRequest,
	type AddInquiryCommentResponse,
	addProjectInquiryAssigneeEndpoint,
	addProjectInquiryCommentEndpoint,
	type CreateProjectInquiryRequest,
	type CreateProjectInquiryResponse,
	createProjectInquiryEndpoint,
	type GetProjectInquiryResponse,
	getProjectInquiryEndpoint,
	type ListProjectInquiriesResponse,
	listProjectInquiriesEndpoint,
	type RemoveInquiryAssigneeResponse,
	type ReopenInquiryResponse,
	removeProjectInquiryAssigneeEndpoint,
	reopenProjectInquiryEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi, callNoBodyApi } from "./core";

/**
 * GET /project/:projectId/inquiries
 * 企画側お問い合わせ一覧
 */
export async function listProjectInquiries(
	projectId: string
): Promise<ListProjectInquiriesResponse> {
	return callGetApi(listProjectInquiriesEndpoint, {
		pathParams: { projectId },
	});
}

/**
 * GET /project/:projectId/inquiries/:inquiryId
 * 企画側お問い合わせ詳細
 */
export async function getProjectInquiry(
	projectId: string,
	inquiryId: string
): Promise<GetProjectInquiryResponse> {
	return callGetApi(getProjectInquiryEndpoint, {
		pathParams: { projectId, inquiryId },
	});
}

/**
 * POST /project/:projectId/inquiries
 * 企画側からお問い合わせを作成
 */
export async function createProjectInquiry(
	projectId: string,
	body: CreateProjectInquiryRequest
): Promise<CreateProjectInquiryResponse> {
	return callBodyApi(createProjectInquiryEndpoint, body, {
		pathParams: { projectId },
	});
}

/**
 * POST /project/:projectId/inquiries/:inquiryId/comments
 * 企画側からコメントを追加
 */
export async function addProjectInquiryComment(
	projectId: string,
	inquiryId: string,
	body: AddInquiryCommentRequest
): Promise<AddInquiryCommentResponse> {
	return callBodyApi(addProjectInquiryCommentEndpoint, body, {
		pathParams: { projectId, inquiryId },
	});
}

/**
 * PATCH /project/:projectId/inquiries/:inquiryId/reopen
 * 企画側から再オープン
 */
export async function reopenProjectInquiry(
	projectId: string,
	inquiryId: string
): Promise<ReopenInquiryResponse> {
	return callNoBodyApi(reopenProjectInquiryEndpoint, {
		pathParams: { projectId, inquiryId },
	});
}

/**
 * POST /project/:projectId/inquiries/:inquiryId/assignees
 * 企画側から担当者を追加
 */
export async function addProjectInquiryAssignee(
	projectId: string,
	inquiryId: string,
	body: AddInquiryAssigneeRequest
): Promise<AddInquiryAssigneeResponse> {
	return callBodyApi(addProjectInquiryAssigneeEndpoint, body, {
		pathParams: { projectId, inquiryId },
	});
}

/**
 * DELETE /project/:projectId/inquiries/:inquiryId/assignees/:assigneeId
 * 企画側から担当者を削除
 */
export async function removeProjectInquiryAssignee(
	projectId: string,
	inquiryId: string,
	assigneeId: string
): Promise<RemoveInquiryAssigneeResponse> {
	return callNoBodyApi(removeProjectInquiryAssigneeEndpoint, {
		pathParams: { projectId, inquiryId, assigneeId },
	});
}
