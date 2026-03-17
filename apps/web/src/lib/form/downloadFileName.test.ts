import { describe, expect, test } from "vitest";
import { buildFormDownloadFileName } from "./downloadFileName";

describe("buildFormDownloadFileName", () => {
	test("企画番号を3桁ゼロ埋めして結合する", () => {
		expect(
			buildFormDownloadFileName({
				projectNumber: 12,
				formTitle: "衛生申請",
				projectName: "テスト企画",
				originalFileName: "提出資料.pdf",
			})
		).toBe("012_衛生申請_テスト企画_提出資料.pdf");
	});

	test("ファイル名に使えない文字を置換する", () => {
		expect(
			buildFormDownloadFileName({
				projectNumber: 7,
				formTitle: "衛生/申請",
				projectName: "企画:テスト",
				originalFileName: '提出<資料>"2026".pdf',
			})
		).toBe("007_衛生_申請_企画_テスト_提出_資料_2026.pdf");
	});

	test("拡張子がない場合もそのまま結合する", () => {
		expect(
			buildFormDownloadFileName({
				projectNumber: 3,
				formTitle: "申請書",
				projectName: "模擬店",
				originalFileName: "提出資料",
			})
		).toBe("003_申請書_模擬店_提出資料");
	});
});
