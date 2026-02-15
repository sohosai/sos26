import { describe, expect, it } from "vitest";
import {
	isTsukubaEmail,
	TSUKUBA_DOMAIN_REGEX,
	tsukubaEmailSchema,
} from "./email";

describe("TSUKUBA_DOMAIN_REGEX", () => {
	it("筑波大学ドメインにマッチする", () => {
		expect(TSUKUBA_DOMAIN_REGEX.test("user@u.tsukuba.ac.jp")).toBe(true);
		expect(TSUKUBA_DOMAIN_REGEX.test("user@s.tsukuba.ac.jp")).toBe(true);
		expect(TSUKUBA_DOMAIN_REGEX.test("user@abc.tsukuba.ac.jp")).toBe(true);
	});

	it("筑波大学以外のドメインにマッチしない", () => {
		expect(TSUKUBA_DOMAIN_REGEX.test("user@example.com")).toBe(false);
		expect(TSUKUBA_DOMAIN_REGEX.test("user@tsukuba.ac.jp")).toBe(false);
		expect(TSUKUBA_DOMAIN_REGEX.test("user@U.tsukuba.ac.jp")).toBe(false);
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

	it("任意のローカル部を受け入れる", () => {
		const result = tsukubaEmailSchema.safeParse("taro.tsukuba@s.tsukuba.ac.jp");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("taro.tsukuba@s.tsukuba.ac.jp");
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

	it("筑波大学以外のメールアドレスを拒否する", () => {
		const result = tsukubaEmailSchema.safeParse("test@example.com");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toContain("筑波大学");
		}
	});

	it("メール形式でない文字列を拒否する", () => {
		const result = tsukubaEmailSchema.safeParse("not-an-email");
		expect(result.success).toBe(false);
	});

	it("サブドメインが欠けているアドレスを拒否する", () => {
		const result = tsukubaEmailSchema.safeParse("s1234567@tsukuba.ac.jp");
		expect(result.success).toBe(false);
	});
});

describe("isTsukubaEmail", () => {
	it("有効な筑波大学メールアドレスでtrueを返す", () => {
		expect(isTsukubaEmail("s1234567@u.tsukuba.ac.jp")).toBe(true);
		expect(isTsukubaEmail("taro@s.tsukuba.ac.jp")).toBe(true);
	});

	it("大文字を含む有効なメールアドレスでtrueを返す", () => {
		expect(isTsukubaEmail("S1234567@U.TSUKUBA.AC.JP")).toBe(true);
	});

	it("前後に空白がある有効なメールアドレスでtrueを返す", () => {
		expect(isTsukubaEmail("  s1234567@u.tsukuba.ac.jp  ")).toBe(true);
	});

	it("無効なメールアドレスでfalseを返す", () => {
		expect(isTsukubaEmail("test@example.com")).toBe(false);
		expect(isTsukubaEmail("s1234567@tsukuba.ac.jp")).toBe(false);
	});
});
