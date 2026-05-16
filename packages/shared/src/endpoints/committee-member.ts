import { z } from "zod";
import {
	committeePermissionSchema,
	createCommitteeMemberRequestSchema,
	createCommitteeMemberResponseSchema,
	deleteCommitteeMemberResponseSchema,
	grantCommitteeMemberPermissionRequestSchema,
	grantCommitteeMemberPermissionResponseSchema,
	listCommitteeMemberPermissionsResponseSchema,
	listCommitteeMembersPickerResponseSchema,
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
	permission: committeePermissionSchema,
});

/**
 * GET /committee/members
 * 委員メンバー一覧を取得（管理画面用・フル情報）
 *
 * - 認証 + 実委メンバー + MEMBER_EDIT 権限必須
 * - deletedAt が null のメンバーのみ返す
 * - user 情報（email, telephoneNumber を含むフル User）を含む
 *
 * 候補者ピッカーなど MEMBER_EDIT を持たないユーザーが利用する場合は
 * {@link listCommitteeMembersPickerEndpoint} を使うこと。
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
 * GET /committee/members/picker
 * 候補者ピッカー用の委員メンバー一覧を取得
 *
 * - 認証 + 実委メンバー必須（MEMBER_EDIT 権限不要）
 * - deletedAt が null のメンバーのみ返す
 * - email / telephoneNumber などの個人情報は含まない
 * - お知らせ／お問い合わせ／申請／企画登録などの担当者選択 UI で使用
 */
export const listCommitteeMembersPickerEndpoint: GetEndpoint<
	"/committee/members/picker",
	undefined,
	undefined,
	typeof listCommitteeMembersPickerResponseSchema
> = {
	method: "GET",
	path: "/committee/members/picker",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listCommitteeMembersPickerResponseSchema,
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
 * GET /committee/members/me/permissions
 * 自分自身の権限一覧を取得
 *
 * - 認証 + 実委メンバー必須
 * - MEMBER_EDIT 権限不要
 */
export const getMyPermissionsEndpoint: GetEndpoint<
	"/committee/members/me/permissions",
	undefined,
	undefined,
	typeof listCommitteeMemberPermissionsResponseSchema
> = {
	method: "GET",
	path: "/committee/members/me/permissions",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listCommitteeMemberPermissionsResponseSchema,
} as const;

/**
 * GET /committee/members/:id/permissions
 * 委員メンバーの権限一覧を取得
 *
 * - 認証 + 実委メンバー必須
 * - MEMBER_EDIT 権限必須
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
 * - MEMBER_EDIT 権限必須
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
 * DELETE /committee/members/:id/permissions/:permission
 * 委員メンバーの権限を削除
 *
 * - 認証 + 実委メンバー必須
 * - MEMBER_EDIT 権限必須
 */
export const revokeCommitteeMemberPermissionEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/members/:id/permissions/:permission",
	typeof committeeMemberPermissionPathParamsSchema,
	undefined,
	typeof revokeCommitteeMemberPermissionResponseSchema
> = {
	method: "DELETE",
	path: "/committee/members/:id/permissions/:permission",
	pathParams: committeeMemberPermissionPathParamsSchema,
	query: undefined,
	request: undefined,
	response: revokeCommitteeMemberPermissionResponseSchema,
} as const;
