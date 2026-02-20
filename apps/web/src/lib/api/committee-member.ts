import {
	type CommitteePermission,
	type CreateCommitteeMemberRequest,
	type CreateCommitteeMemberResponse,
	createCommitteeMemberEndpoint,
	type DeleteCommitteeMemberResponse,
	deleteCommitteeMemberEndpoint,
	type GrantCommitteeMemberPermissionRequest,
	type GrantCommitteeMemberPermissionResponse,
	grantCommitteeMemberPermissionEndpoint,
	type ListCommitteeMemberPermissionsResponse,
	type ListCommitteeMembersResponse,
	listCommitteeMemberPermissionsEndpoint,
	listCommitteeMembersEndpoint,
	type RevokeCommitteeMemberPermissionResponse,
	revokeCommitteeMemberPermissionEndpoint,
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

/**
 * GET /committee/members/:id/permissions
 * 委員メンバーの権限一覧を取得
 */
export async function listCommitteeMemberPermissions(
	id: string
): Promise<ListCommitteeMemberPermissionsResponse> {
	return callGetApi(listCommitteeMemberPermissionsEndpoint, {
		pathParams: { id },
	});
}

/**
 * POST /committee/members/:id/permissions
 * 委員メンバーに権限を付与
 */
export async function grantCommitteeMemberPermission(
	id: string,
	body: GrantCommitteeMemberPermissionRequest
): Promise<GrantCommitteeMemberPermissionResponse> {
	return callBodyApi(grantCommitteeMemberPermissionEndpoint, body, {
		pathParams: { id },
	});
}

/**
 * DELETE /committee/members/:id/permissions/:permission
 * 委員メンバーの権限を削除
 */
export async function revokeCommitteeMemberPermission(
	id: string,
	permission: CommitteePermission
): Promise<RevokeCommitteeMemberPermissionResponse> {
	return callNoBodyApi(revokeCommitteeMemberPermissionEndpoint, {
		pathParams: { id, permission },
	});
}
