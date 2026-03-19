import { describe, expect, it } from "vitest";
import { isKana, toHiragana } from "./phonetic";

describe("toHiragana", () => {
	it("カタカナをひらがなに変換する", () => {
		expect(toHiragana("ツクバタロウ")).toBe("つくばたろう");
	});

	it("ひらがなはそのまま", () => {
		expect(toHiragana("つくばたろう")).toBe("つくばたろう");
	});

	it("混在した文字列を正しく変換する", () => {
		expect(toHiragana("ツクバたろう")).toBe("つくばたろう");
	});

	it("長音記号を保持する", () => {
		expect(toHiragana("ソースコード")).toBe("そーすこーど");
	});

	it("漢字・英数字はそのまま", () => {
		expect(toHiragana("テスト123漢字")).toBe("てすと123漢字");
	});

	it("空文字列を処理する", () => {
		expect(toHiragana("")).toBe("");
	});
});

describe("isKana", () => {
	it("ひらがなのみの文字列を受け入れる", () => {
		expect(isKana("つくばたろう")).toBe(true);
	});

	it("カタカナのみの文字列を受け入れる", () => {
		expect(isKana("ツクバタロウ")).toBe(true);
	});

	it("ひらがなとカタカナの混在を受け入れる", () => {
		expect(isKana("つくばタロウ")).toBe(true);
	});

	it("長音記号を含むかなを受け入れる", () => {
		expect(isKana("そーすこーど")).toBe(true);
	});

	it("スペースを含むかなを受け入れる", () => {
		expect(isKana("つくば たろう")).toBe(true);
	});

	it("全角スペースを含むかなを受け入れる", () => {
		expect(isKana("つくば　たろう")).toBe(true);
	});

	it("漢字を含む文字列を拒否する", () => {
		expect(isKana("筑波太郎")).toBe(false);
	});

	it("英数字を含む文字列を拒否する", () => {
		expect(isKana("てすと123")).toBe(false);
	});

	it("空文字列を拒否する", () => {
		expect(isKana("")).toBe(false);
	});
});
