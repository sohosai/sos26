import {
	type CreateCommitteeMemberRequest,
	type CreateCommitteeMemberResponse,
	createCommitteeMemberEndpoint,
	type DeleteCommitteeMemberResponse,
	deleteCommitteeMemberEndpoint,
	type ListCommitteeMembersResponse,
	listCommitteeMembersEndpoint,
	type UpdateCommitteeMemberRequest,
	type UpdateCommitteeMemberResponse,
	updateCommitteeMemberEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi, callNoBodyApi } from "./core";

/**
 * GET /committee-members
 * 委員メンバー一覧を取得
 */
export async function listCommitteeMembers(): Promise<ListCommitteeMembersResponse> {
	return callGetApi(listCommitteeMembersEndpoint);
}

/**
 * POST /committee-members
 * 委員メンバーを作成
 */
export async function createCommitteeMember(
	body: CreateCommitteeMemberRequest
): Promise<CreateCommitteeMemberResponse> {
	return callBodyApi(createCommitteeMemberEndpoint, body);
}

/**
 * PATCH /committee-members/:id
 * 委員メンバーを更新
 */
export async function updateCommitteeMember(
	id: string,
	body: UpdateCommitteeMemberRequest
): Promise<UpdateCommitteeMemberResponse> {
	return callBodyApi(updateCommitteeMemberEndpoint, body, {
		pathParams: { id },
	});
}

/**
 * DELETE /committee-members/:id
 * 委員メンバーをソフトデリート
 */
export async function deleteCommitteeMember(
	id: string
): Promise<DeleteCommitteeMemberResponse> {
	return callNoBodyApi(deleteCommitteeMemberEndpoint, {
		pathParams: { id },
	});
}
