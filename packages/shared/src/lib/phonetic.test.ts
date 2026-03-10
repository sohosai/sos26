import { describe, expect, it } from "vitest";
import { toHiragana } from "./phonetic";

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
