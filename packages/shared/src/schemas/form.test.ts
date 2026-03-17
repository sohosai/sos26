import { describe, expect, it } from "vitest";
import { createFormItemInputSchema } from "./form";

function createBaseItem(overrides: Record<string, unknown> = {}) {
	return {
		label: "添付資料",
		description: "資料を提出してください",
		type: "FILE",
		required: false,
		sortOrder: 0,
		...overrides,
	};
}

describe("createFormItemInputSchema", () => {
	describe("FILE constraints", () => {
		it("minFiles/maxFiles を受け入れる", () => {
			const result = createFormItemInputSchema.safeParse(
				createBaseItem({
					constraints: {
						minFiles: 1,
						maxFiles: 3,
					},
				})
			);

			expect(result.success).toBe(true);
		});

		it("FILE に文字数制約があると拒否する", () => {
			const result = createFormItemInputSchema.safeParse(
				createBaseItem({
					constraints: {
						minLength: 2,
					},
				})
			);

			expect(result.success).toBe(false);
		});

		it("minFiles > maxFiles を拒否する", () => {
			const result = createFormItemInputSchema.safeParse(
				createBaseItem({
					constraints: {
						minFiles: 4,
						maxFiles: 3,
					},
				})
			);

			expect(result.success).toBe(false);
		});
	});

	describe("TEXT constraints", () => {
		it("TEXT にファイル数制約があると拒否する", () => {
			const result = createFormItemInputSchema.safeParse(
				createBaseItem({
					type: "TEXT",
					constraints: {
						minFiles: 1,
					},
				})
			);

			expect(result.success).toBe(false);
		});
	});
});
