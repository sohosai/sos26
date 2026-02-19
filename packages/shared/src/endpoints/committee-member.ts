import { z } from "zod";
import {
	createCommitteeMemberRequestSchema,
	createCommitteeMemberResponseSchema,
	deleteCommitteeMemberResponseSchema,
	grantCommitteeMemberPermissionRequestSchema,
	grantCommitteeMemberPermissionResponseSchema,
	listCommitteeMemberPermissionsResponseSchema,
	listCommitteeMembersResponseSchema,
	revokeCommitteeMemberPermissionResponseSchema,
	updateCommitteeMemberRequestSchema,
	updateCommitteeMemberResponseSchema,
} from "../schemas/committee-member";
import type { BodyEndpoint, GetEndpoint, NoBodyEndpoint } from "./types";

const committeeMemberPathParamsSchema = z.object({
	id: z.cuid(),
});

const committeeMemberPermissionPathParamsSchema = z.object({
	id: z.cuid(),
	permissionId: z.cuid(),
});

/**
 * GET /committee/members
 * 委員メンバー一覧を取得
 *
 * - 認証 + 実委メンバー必須
 * - deletedAt が null のメンバーのみ返す
 * - user 情報を含む
 */
export const listCommitteeMembersEndpoint: GetEndpoint<
	"/committee/members",
	undefined,
	undefined,
	typeof listCommitteeMembersResponseSchema
> = {
	method: "GET",
	path: "/committee/members",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listCommitteeMembersResponseSchema,
} as const;

/**
 * POST /committee/members
 * 委員メンバーを作成
 *
 * - 認証 + 実委メンバー必須
 * - userId のユーザーが存在することを確認
 * - 既にメンバーの場合は ALREADY_EXISTS エラー
 * - ソフトデリート済みの場合は再有効化
 */
export const createCommitteeMemberEndpoint: BodyEndpoint<
	"POST",
	"/committee/members",
	undefined,
	undefined,
	typeof createCommitteeMemberRequestSchema,
	typeof createCommitteeMemberResponseSchema
> = {
	method: "POST",
	path: "/committee/members",
	pathParams: undefined,
	query: undefined,
	request: createCommitteeMemberRequestSchema,
	response: createCommitteeMemberResponseSchema,
} as const;

/**
 * PATCH /committee/members/:id
 * 委員メンバーを更新
 *
 * - 認証 + 実委メンバー必須
 * - Bureau, isExecutive を部分更新可能
 * - エラー: NOT_FOUND
 */
export const updateCommitteeMemberEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/members/:id",
	typeof committeeMemberPathParamsSchema,
	undefined,
	typeof updateCommitteeMemberRequestSchema,
	typeof updateCommitteeMemberResponseSchema
> = {
	method: "PATCH",
	path: "/committee/members/:id",
	pathParams: committeeMemberPathParamsSchema,
	query: undefined,
	request: updateCommitteeMemberRequestSchema,
	response: updateCommitteeMemberResponseSchema,
} as const;

/**
 * DELETE /committee/members/:id
 * 委員メンバーをソフトデリート
 *
 * - 認証 + 実委メンバー必須
 * - deletedAt を設定
 * - エラー: NOT_FOUND
 */
export const deleteCommitteeMemberEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/members/:id",
	typeof committeeMemberPathParamsSchema,
	undefined,
	typeof deleteCommitteeMemberResponseSchema
> = {
	method: "DELETE",
	path: "/committee/members/:id",
	pathParams: committeeMemberPathParamsSchema,
	query: undefined,
	request: undefined,
	response: deleteCommitteeMemberResponseSchema,
} as const;

// ─────────────────────────────────────────────────────────────
// 権限管理エンドポイント
// ─────────────────────────────────────────────────────────────

/**
 * GET /committee/members/:id/permissions
 * 委員メンバーの権限一覧を取得
 *
 * - 認証 + 実委メンバー必須
 * - TODO: 権限チェックの調整
 */
export const listCommitteeMemberPermissionsEndpoint: GetEndpoint<
	"/committee/members/:id/permissions",
	typeof committeeMemberPathParamsSchema,
	undefined,
	typeof listCommitteeMemberPermissionsResponseSchema
> = {
	method: "GET",
	path: "/committee/members/:id/permissions",
	pathParams: committeeMemberPathParamsSchema,
	query: undefined,
	request: undefined,
	response: listCommitteeMemberPermissionsResponseSchema,
} as const;

/**
 * POST /committee/members/:id/permissions
 * 委員メンバーに権限を付与
 *
 * - 認証 + 実委メンバー必須
 * - TODO: 権限チェックの調整
 */
export const grantCommitteeMemberPermissionEndpoint: BodyEndpoint<
	"POST",
	"/committee/members/:id/permissions",
	typeof committeeMemberPathParamsSchema,
	undefined,
	typeof grantCommitteeMemberPermissionRequestSchema,
	typeof grantCommitteeMemberPermissionResponseSchema
> = {
	method: "POST",
	path: "/committee/members/:id/permissions",
	pathParams: committeeMemberPathParamsSchema,
	query: undefined,
	request: grantCommitteeMemberPermissionRequestSchema,
	response: grantCommitteeMemberPermissionResponseSchema,
} as const;

/**
 * DELETE /committee/members/:id/permissions/:permissionId
 * 委員メンバーの権限を削除
 *
 * - 認証 + 実委メンバー必須
 * - TODO: 権限チェックの調整
 */
export const revokeCommitteeMemberPermissionEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/members/:id/permissions/:permissionId",
	typeof committeeMemberPermissionPathParamsSchema,
	undefined,
	typeof revokeCommitteeMemberPermissionResponseSchema
> = {
	method: "DELETE",
	path: "/committee/members/:id/permissions/:permissionId",
	pathParams: committeeMemberPermissionPathParamsSchema,
	query: undefined,
	request: undefined,
	response: revokeCommitteeMemberPermissionResponseSchema,
} as const;
