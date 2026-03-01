import { z } from "zod";
import { userSchema } from "./user";

/**
 * 局（Bureau）スキーマ
 * Prisma の Bureau enum に対応
 */
export const bureauSchema = z.enum([
	"FINANCE",
	"GENERAL_AFFAIRS",
	"PUBLIC_RELATIONS",
	"EXTERNAL",
	"PROMOTION",
	"PLANNING",
	"STAGE_MANAGEMENT",
	"HQ_PLANNING",
	"INFO_SYSTEM",
	"INFORMATION",
]);
export type Bureau = z.infer<typeof bureauSchema>;

export const bureauLabelMap: Record<Bureau, string> = {
	FINANCE: "財務局",
	GENERAL_AFFAIRS: "総務局",
	PUBLIC_RELATIONS: "広報宣伝局",
	EXTERNAL: "渉外局",
	PROMOTION: "推進局",
	PLANNING: "総合計画局",
	STAGE_MANAGEMENT: "ステージ管理局",
	HQ_PLANNING: "本部企画局",
	INFO_SYSTEM: "情報メディアシステム局",
	INFORMATION: "案内所運営部会",
} as const;

/**
 * 委員メンバースキーマ
 */
export const committeeMemberSchema = z.object({
	id: z.cuid(),
	userId: z.string().min(1),
	isExecutive: z.boolean(),
	Bureau: bureauSchema,
	joinedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
});
export type CommitteeMember = z.infer<typeof committeeMemberSchema>;

// ─────────────────────────────────────────────────────────────
// 権限管理
// ─────────────────────────────────────────────────────────────

/**
 * 実委人権限スキーマ
 * Prisma の CommitteePermission enum に対応
 */
export const committeePermissionSchema = z.enum([
	"MEMBER_EDIT",
	"NOTICE_DELIVER",
	"FORM_DELIVER",
	"INQUIRY_ADMIN",
]);
export type CommitteePermission = z.infer<typeof committeePermissionSchema>;

/**
 * 実委人権限レコードスキーマ
 */
export const committeeMemberPermissionSchema = z.object({
	id: z.cuid(),
	committeeMemberId: z.cuid(),
	permission: committeePermissionSchema,
	createdAt: z.coerce.date(),
});
export type CommitteeMemberPermission = z.infer<
	typeof committeeMemberPermissionSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee-members
// ─────────────────────────────────────────────────────────────

/**
 * 委員メンバー一覧レスポンス（user 含む）
 */
export const listCommitteeMembersResponseSchema = z.object({
	committeeMembers: z.array(
		committeeMemberSchema.extend({
			user: userSchema,
			permissions: z.array(committeeMemberPermissionSchema),
		})
	),
});

export type ListCommitteeMembersResponse = z.infer<
	typeof listCommitteeMembersResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// POST /committee-members
// ─────────────────────────────────────────────────────────────

/**
 * 委員メンバー作成リクエスト
 */
export const createCommitteeMemberRequestSchema = z.object({
	userId: z.string().min(1, "ユーザーIDを指定してください"),
	Bureau: bureauSchema,
	isExecutive: z.boolean().optional(),
});
export type CreateCommitteeMemberRequest = z.infer<
	typeof createCommitteeMemberRequestSchema
>;

/**
 * 委員メンバー作成レスポンス
 */
export const createCommitteeMemberResponseSchema = z.object({
	committeeMember: committeeMemberSchema,
});
export type CreateCommitteeMemberResponse = z.infer<
	typeof createCommitteeMemberResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee-members/:id
// ─────────────────────────────────────────────────────────────

/**
 * 委員メンバー更新リクエスト
 */
export const updateCommitteeMemberRequestSchema = z.object({
	Bureau: bureauSchema.optional(),
	isExecutive: z.boolean().optional(),
});
export type UpdateCommitteeMemberRequest = z.infer<
	typeof updateCommitteeMemberRequestSchema
>;

/**
 * 委員メンバー更新レスポンス
 */
export const updateCommitteeMemberResponseSchema = z.object({
	committeeMember: committeeMemberSchema,
});
export type UpdateCommitteeMemberResponse = z.infer<
	typeof updateCommitteeMemberResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// DELETE /committee-members/:id
// ─────────────────────────────────────────────────────────────

/**
 * 委員メンバー削除レスポンス
 */
export const deleteCommitteeMemberResponseSchema = z.object({
	success: z.literal(true),
});
export type DeleteCommitteeMemberResponse = z.infer<
	typeof deleteCommitteeMemberResponseSchema
>;

// GET /committee/members/:id/permissions

/**
 * 権限一覧レスポンス
 */
export const listCommitteeMemberPermissionsResponseSchema = z.object({
	permissions: z.array(committeeMemberPermissionSchema),
});
export type ListCommitteeMemberPermissionsResponse = z.infer<
	typeof listCommitteeMemberPermissionsResponseSchema
>;

// POST /committee/members/:id/permissions

/**
 * 権限付与リクエスト
 */
export const grantCommitteeMemberPermissionRequestSchema = z.object({
	permission: committeePermissionSchema,
});
export type GrantCommitteeMemberPermissionRequest = z.infer<
	typeof grantCommitteeMemberPermissionRequestSchema
>;

/**
 * 権限付与レスポンス
 */
export const grantCommitteeMemberPermissionResponseSchema = z.object({
	permissionRecord: committeeMemberPermissionSchema,
});
export type GrantCommitteeMemberPermissionResponse = z.infer<
	typeof grantCommitteeMemberPermissionResponseSchema
>;

// DELETE /committee/members/:id/permissions/:permission

/**
 * 権限削除レスポンス
 */
export const revokeCommitteeMemberPermissionResponseSchema = z.object({
	success: z.literal(true),
});
export type RevokeCommitteeMemberPermissionResponse = z.infer<
	typeof revokeCommitteeMemberPermissionResponseSchema
>;
