import { z } from "zod";

/**
 * 筑波大学メールアドレスの正規表現
 * 形式: s{学籍番号7桁}@u.tsukuba.ac.jp
 * エイリアス形式も許可: s{学籍番号7桁}+{任意}@u.tsukuba.ac.jp
 */
export const TSUKUBA_EMAIL_REGEX =
	/^s\d{7}(\+[a-zA-Z0-9._-]+)?@u\.tsukuba\.ac\.jp$/;

/**
 * 筑波大学メールアドレススキーマ
 *
 * - 小文字に正規化（trim + lowercase）
 * - 筑波大学のメールアドレス形式を検証
 */
export const tsukubaEmailSchema = z
	.string()
	.transform(email => email.trim().toLowerCase())
	.pipe(
		z.string().regex(TSUKUBA_EMAIL_REGEX, {
			message:
				"筑波大学のメールアドレス（s0000000@u.tsukuba.ac.jp）を入力してください",
		})
	);

export type TsukubaEmail = z.infer<typeof tsukubaEmailSchema>;

/**
 * 筑波大学メールアドレスかどうかを判定するヘルパー関数
 */
export function isTsukubaEmail(email: string): boolean {
	return TSUKUBA_EMAIL_REGEX.test(email.trim().toLowerCase());
}
