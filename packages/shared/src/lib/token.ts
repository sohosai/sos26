import { z } from "zod";

/**
 * base64url形式の正規表現
 * A-Z, a-z, 0-9, -, _ のみ許可（パディングなし）
 */
const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * 検証トークンスキーマ
 * randomBytes(32).toString('base64url') = 43文字
 */
export const verificationTokenSchema = z
	.string()
	.min(43, "トークンの形式が不正です")
	.regex(BASE64URL_REGEX, "トークンの形式が不正です");
export type VerificationToken = z.infer<typeof verificationTokenSchema>;

/**
 * トークンハッシュスキーマ（DB保存用）
 * SHA-256ハッシュの16進数表現 = 64文字
 */
export const tokenHashSchema = z
	.string()
	.length(64, "ハッシュの形式が不正です")
	.regex(/^[a-f0-9]+$/, "ハッシュの形式が不正です");
export type TokenHash = z.infer<typeof tokenHashSchema>;
