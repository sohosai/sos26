import type { FormAnswerInput, FormAnswerValidationItem } from "@sos26/shared";
import { describe, expect, it } from "vitest";
import { assertFileCountConstraints } from "./form-answer-validation";

function createFileItem(
	overrides: Partial<FormAnswerValidationItem> = {}
): FormAnswerValidationItem {
	return {
		id: "item-1",
		type: "FILE",
		required: false,
		options: [],
		constraints: null,
		...overrides,
	};
}

function createFileAnswer(fileIds: string[]): FormAnswerInput {
	return {
		type: "FILE",
		formItemId: "item-1",
		fileIds,
	};
}

describe("assertFileCountConstraints", () => {
	it("制約内なら通る", () => {
		expect(() =>
			assertFileCountConstraints(
				[
					createFileItem({
						constraints: {
							minFiles: 1,
							maxFiles: 3,
						},
					}),
				],
				[createFileAnswer(["file-1", "file-2"])]
			)
		).not.toThrow();
	});

	it("最小数未満なら失敗する", () => {
		expect(() =>
			assertFileCountConstraints(
				[
					createFileItem({
						constraints: {
							minFiles: 2,
						},
					}),
				],
				[createFileAnswer(["file-1"])]
			)
		).toThrow("2個以上添付してください");
	});

	it("最大数超過なら失敗する", () => {
		expect(() =>
			assertFileCountConstraints(
				[
					createFileItem({
						constraints: {
							maxFiles: 2,
						},
					}),
				],
				[createFileAnswer(["file-1", "file-2", "file-3"])]
			)
		).toThrow("2個以内で添付してください");
	});
});
