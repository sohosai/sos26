import { tokenHashSchema, verificationTokenSchema } from "@sos26/shared";
import { describe, expect, it } from "vitest";
import { generateVerificationToken, hashToken } from "./token";

describe("tokenユーティリティ", () => {
	it("base64url形式の検証トークンを生成する", () => {
		// Arrange（準備）
		// なし

		// Act（実行）
		const token = generateVerificationToken();

		// Assert（検証）
		// スキーマ妥当性（長さ>=43、base64url 文字クラス）
		expect(() => verificationTokenSchema.parse(token)).not.toThrow();
		// 追加の実用的チェック
		expect(typeof token).toBe("string");
		expect(token.length).toBeGreaterThanOrEqual(43);
		expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
	});

	it("連続呼び出しで異なるトークンを生成する", () => {
		// Arrange
		// なし

		// Act
		const a = generateVerificationToken();
		const b = generateVerificationToken();

		// Assert
		expect(a).not.toEqual(b);
	});

	it("hashTokenは64桁のsha256 hexを返す", () => {
		// Arrange
		const token = generateVerificationToken();

		// Act
		const hash = hashToken(token);

		// Assert
		expect(() => tokenHashSchema.parse(hash)).not.toThrow();
		expect(typeof hash).toBe("string");
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	it("同一入力で決定的、異なる入力で異なるハッシュになる", () => {
		// Arrange
		const token1 = generateVerificationToken();
		const token2 = generateVerificationToken();

		// Act
		const h1a = hashToken(token1);
		const h1b = hashToken(token1);
		const h2 = hashToken(token2);

		// Assert
		expect(h1a).toEqual(h1b); // 同一入力→同一結果
		expect(h1a).not.toEqual(h2); // 異なる入力→異なる結果（極めて高確率）
	});
});
