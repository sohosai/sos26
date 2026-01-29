import { z } from "zod";
import { tsukubaEmailSchema } from "../lib/email";
import { verificationTokenSchema } from "../lib/token";
import { firstNameSchema, lastNameSchema, userSchema } from "./user";

// ─────────────────────────────────────────────────────────────
// POST /auth/email/start
// ─────────────────────────────────────────────────────────────

/**
 * メール検証開始リクエスト
 */
export const startEmailVerificationRequestSchema = z.object({
	email: tsukubaEmailSchema,
});
export type StartEmailVerificationRequest = z.infer<
	typeof startEmailVerificationRequestSchema
>;

/**
 * メール検証開始レスポンス
 */
export const startEmailVerificationResponseSchema = z.object({
	success: z.literal(true),
});
export type StartEmailVerificationResponse = z.infer<
	typeof startEmailVerificationResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// POST /auth/email/verify
// ─────────────────────────────────────────────────────────────

/**
 * メール検証確定リクエスト
 */
export const verifyEmailRequestSchema = z.object({
	token: verificationTokenSchema,
});
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

/**
 * メール検証確定レスポンス
 */
export const verifyEmailResponseSchema = z.object({
	success: z.literal(true),
	email: tsukubaEmailSchema,
});
export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;

// ─────────────────────────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────────────────────────

/**
 * パスワード要件
 * - 最小8文字
 * - 最大128文字
 */
export const passwordSchema = z
	.string()
	.min(8, "パスワードは8文字以上で入力してください")
	.max(128, "パスワードは128文字以下で入力してください");

/**
 * 本登録リクエスト
 */
export const registerRequestSchema = z.object({
	firstName: firstNameSchema,
	lastName: lastNameSchema,
	password: passwordSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/**
 * 本登録レスポンス
 */
export const registerResponseSchema = z.object({
	user: userSchema,
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

// ─────────────────────────────────────────────────────────────
// GET /auth/me
// ─────────────────────────────────────────────────────────────

/**
 * 現在のユーザー取得レスポンス
 */
export const getMeResponseSchema = z.object({
	user: userSchema,
});
export type GetMeResponse = z.infer<typeof getMeResponseSchema>;
