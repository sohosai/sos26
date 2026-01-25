import { createHash, randomBytes } from "node:crypto";
import {
	type TokenHash,
	tokenHashSchema,
	type VerificationToken,
	verificationTokenSchema,
} from "@sos26/shared";

/**
 * 32バイトのランダム値を base64url 文字列（パディングなし）で返す。
 * shared の検証トークンスキーマで型安全に保証する。
 */
export function generateVerificationToken(): VerificationToken {
	const token = randomBytes(32).toString("base64url");
	return verificationTokenSchema.parse(token);
}

/**
 * トークンの SHA-256 ハッシュ（hex）を返す。
 * DB 保存・比較は常にハッシュを使用する。
 */
export function hashToken(token: string): TokenHash {
	const hash = createHash("sha256").update(token).digest("hex");
	return tokenHashSchema.parse(hash);
}

export type { VerificationToken, TokenHash };
