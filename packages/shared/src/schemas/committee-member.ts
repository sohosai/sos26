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
// GET /committee-members
// ─────────────────────────────────────────────────────────────

/**
 * 委員メンバー一覧レスポンス（user 含む）
 */
export const listCommitteeMembersResponseSchema = z.object({
	committeeMembers: z.array(
		committeeMemberSchema.extend({
			user: userSchema,
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
