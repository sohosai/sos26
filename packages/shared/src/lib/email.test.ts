import { describe, expect, it } from "vitest";
import {
	isTsukubaEmail,
	TSUKUBA_EMAIL_REGEX,
	tsukubaEmailSchema,
} from "./email";

describe("TSUKUBA_EMAIL_REGEX", () => {
	it("有効な筑波大学メールアドレスにマッチする", () => {
		expect(TSUKUBA_EMAIL_REGEX.test("s1234567@u.tsukuba.ac.jp")).toBe(true);
		expect(TSUKUBA_EMAIL_REGEX.test("s0000000@u.tsukuba.ac.jp")).toBe(true);
		expect(TSUKUBA_EMAIL_REGEX.test("s9999999@u.tsukuba.ac.jp")).toBe(true);
	});

	it("エイリアス形式のメールアドレスにマッチする", () => {
		expect(TSUKUBA_EMAIL_REGEX.test("s1234567+test@u.tsukuba.ac.jp")).toBe(
			true
		);
		expect(TSUKUBA_EMAIL_REGEX.test("s1234567+foo.bar@u.tsukuba.ac.jp")).toBe(
			true
		);
		expect(TSUKUBA_EMAIL_REGEX.test("s1234567+a-b_c@u.tsukuba.ac.jp")).toBe(
			true
		);
	});

	it("無効なエイリアス形式にマッチしない", () => {
		// +の後に何もない
		expect(TSUKUBA_EMAIL_REGEX.test("s1234567+@u.tsukuba.ac.jp")).toBe(false);
	});

	it("無効なメールアドレスにマッチしない", () => {
		// 筑波大学ドメインではない
		expect(TSUKUBA_EMAIL_REGEX.test("test@example.com")).toBe(false);
		// sで始まっていない
		expect(TSUKUBA_EMAIL_REGEX.test("t1234567@u.tsukuba.ac.jp")).toBe(false);
		// 数字が6桁（7桁必要）
		expect(TSUKUBA_EMAIL_REGEX.test("s123456@u.tsukuba.ac.jp")).toBe(false);
		// 数字が8桁（7桁必要）
		expect(TSUKUBA_EMAIL_REGEX.test("s12345678@u.tsukuba.ac.jp")).toBe(false);
		// u. が欠けている
		expect(TSUKUBA_EMAIL_REGEX.test("s1234567@tsukuba.ac.jp")).toBe(false);
		// 大文字のS（小文字のみ許可）
		expect(TSUKUBA_EMAIL_REGEX.test("S1234567@u.tsukuba.ac.jp")).toBe(false);
		// 数字以外の文字が含まれている
		expect(TSUKUBA_EMAIL_REGEX.test("s123456a@u.tsukuba.ac.jp")).toBe(false);
		// s.tsukuba.ac.jp ドメイン（u.のみ許可）
		expect(TSUKUBA_EMAIL_REGEX.test("s1234567@s.tsukuba.ac.jp")).toBe(false);
		// 複数の+を含む（未許可）
		expect(TSUKUBA_EMAIL_REGEX.test("s1234567+foo+bar@u.tsukuba.ac.jp")).toBe(
			false
		);
		// 非ASCIIのエイリアス（未許可）
		expect(TSUKUBA_EMAIL_REGEX.test("s1234567+テスト@u.tsukuba.ac.jp")).toBe(
			false
		);
	});
});

describe("tsukubaEmailSchema", () => {
	it("有効な筑波大学メールアドレスを受け入れる", () => {
		const result = tsukubaEmailSchema.safeParse("s1234567@u.tsukuba.ac.jp");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("s1234567@u.tsukuba.ac.jp");
		}
	});

	it("エイリアス形式のメールアドレスを受け入れる", () => {
		const result = tsukubaEmailSchema.safeParse(
			"s1234567+test@u.tsukuba.ac.jp"
		);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("s1234567+test@u.tsukuba.ac.jp");
		}
	});

	it("前後の空白をトリムする", () => {
		const result = tsukubaEmailSchema.safeParse("  s1234567@u.tsukuba.ac.jp  ");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("s1234567@u.tsukuba.ac.jp");
		}
	});

	it("大文字を小文字に変換する", () => {
		const result = tsukubaEmailSchema.safeParse("S1234567@U.TSUKUBA.AC.JP");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("s1234567@u.tsukuba.ac.jp");
		}
	});

	it("大文字とエイリアスを含んでも許容する", () => {
		const result = tsukubaEmailSchema.safeParse(
			"S1234567+TEST_ALIAS@U.TSUKUBA.AC.JP"
		);
		expect(result.success).toBe(true);
		if (result.success) {
			// 変換後は小文字
			expect(result.data).toBe("s1234567+test_alias@u.tsukuba.ac.jp");
		}
	});

	it("筑波大学以外のメールアドレスを拒否する", () => {
		const result = tsukubaEmailSchema.safeParse("test@example.com");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toContain("筑波大学");
		}
	});

	it("形式が不正なメールアドレスを拒否する", () => {
		const invalidEmails = [
			"t1234567@u.tsukuba.ac.jp", // sで始まっていない
			"s123456@u.tsukuba.ac.jp", // 6桁
			"s12345678@u.tsukuba.ac.jp", // 8桁
			"s1234567@tsukuba.ac.jp", // u.が欠けている
			"s123456a@u.tsukuba.ac.jp", // 数字以外
		];

		for (const email of invalidEmails) {
			const result = tsukubaEmailSchema.safeParse(email);
			expect(result.success).toBe(false);
		}
	});
});

describe("isTsukubaEmail", () => {
	it("有効な筑波大学メールアドレスでtrueを返す", () => {
		expect(isTsukubaEmail("s1234567@u.tsukuba.ac.jp")).toBe(true);
		expect(isTsukubaEmail("s0000000@u.tsukuba.ac.jp")).toBe(true);
	});

	it("エイリアス形式のメールアドレスでtrueを返す", () => {
		expect(isTsukubaEmail("s1234567+test@u.tsukuba.ac.jp")).toBe(true);
		expect(isTsukubaEmail("s1234567+foo.bar@u.tsukuba.ac.jp")).toBe(true);
	});

	it("大文字を含む有効なメールアドレスでtrueを返す", () => {
		expect(isTsukubaEmail("S1234567@U.TSUKUBA.AC.JP")).toBe(true);
	});

	it("前後に空白がある有効なメールアドレスでtrueを返す", () => {
		expect(isTsukubaEmail("  s1234567@u.tsukuba.ac.jp  ")).toBe(true);
	});

	it("無効なメールアドレスでfalseを返す", () => {
		expect(isTsukubaEmail("test@example.com")).toBe(false);
		expect(isTsukubaEmail("t1234567@u.tsukuba.ac.jp")).toBe(false);
		expect(isTsukubaEmail("s123456@u.tsukuba.ac.jp")).toBe(false);
	});
});
