import { z } from "zod";

/**
 * 筑波大学ドメインの正規表現（ドメイン部分のみ検証）
 * 形式: ...@{サブドメイン}.tsukuba.ac.jp
 */
export const TSUKUBA_DOMAIN_REGEX = /@[a-z0-9-]+\.tsukuba\.ac\.jp$/;

/**
 * 筑波大学メールアドレススキーマ
 *
 * - 小文字に正規化（trim + lowercase）
 * - zodのemail()で基本的なメール形式を検証
 * - 筑波大学ドメインを検証
 */
export const tsukubaEmailSchema = z
	.string()
	.transform(email => email.trim().toLowerCase())
	.pipe(
		z
			.email("有効なメールアドレスを入力してください")
			.regex(TSUKUBA_DOMAIN_REGEX, {
				message:
					"筑波大学のメールアドレス（例: xxx@xxx.tsukuba.ac.jp）を入力してください",
			})
	);

export type TsukubaEmail = z.infer<typeof tsukubaEmailSchema>;

/**
 * 筑波大学メールアドレスかどうかを判定するヘルパー関数
 */
export function isTsukubaEmail(email: string): boolean {
	return TSUKUBA_DOMAIN_REGEX.test(email.trim().toLowerCase());
}
