import {
	type CommitteePermission,
	type CreateCommitteeMemberRequest,
	type CreateCommitteeMemberResponse,
	createCommitteeMemberEndpoint,
	type DeleteCommitteeMemberResponse,
	deleteCommitteeMemberEndpoint,
	type GrantCommitteeMemberPermissionRequest,
	type GrantCommitteeMemberPermissionResponse,
	getMyPermissionsEndpoint,
	grantCommitteeMemberPermissionEndpoint,
	type ListCommitteeMemberPermissionsResponse,
	type ListCommitteeMembersDirectoryResponse,
	type ListCommitteeMembersResponse,
	listCommitteeMemberPermissionsEndpoint,
	listCommitteeMembersDirectoryEndpoint,
	listCommitteeMembersEndpoint,
	type RevokeCommitteeMemberPermissionResponse,
	revokeCommitteeMemberPermissionEndpoint,
	type UpdateCommitteeMemberRequest,
	type UpdateCommitteeMemberResponse,
	updateCommitteeMemberEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi, callNoBodyApi } from "./core";

/**
 * GET /committee/members
 * 委員メンバー一覧を取得（管理画面用・フル情報）
 *
 * MEMBER_EDIT 権限が必須。候補者ピッカーなど MEMBER_EDIT を持たない
 * ユーザーが利用する場合は {@link listCommitteeMembersDirectory} を使うこと。
 */
export async function listCommitteeMembers(): Promise<ListCommitteeMembersResponse> {
	return callGetApi(listCommitteeMembersEndpoint);
}

/**
 * GET /committee/members/directory
 * 候補者ピッカー用の委員メンバー一覧を取得（最小情報）
 *
 * MEMBER_EDIT 権限は不要。email / telephoneNumber などの個人情報は含まない。
 */
export async function listCommitteeMembersDirectory(): Promise<ListCommitteeMembersDirectoryResponse> {
	return callGetApi(listCommitteeMembersDirectoryEndpoint);
}

/**
 * POST /committee/members
 * 委員メンバーを作成
 */
export async function createCommitteeMember(
	body: CreateCommitteeMemberRequest
): Promise<CreateCommitteeMemberResponse> {
	return callBodyApi(createCommitteeMemberEndpoint, body);
}

/**
 * PATCH /committee/members/:id
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
 * DELETE /committee/members/:id
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
 * GET /committee/members/me/permissions
 * 自分自身の権限一覧を取得
 */
export async function getMyPermissions(): Promise<ListCommitteeMemberPermissionsResponse> {
	return callGetApi(getMyPermissionsEndpoint);
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
