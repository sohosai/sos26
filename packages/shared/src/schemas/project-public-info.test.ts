import { describe, expect, it } from "vitest";
import {
	PROJECT_DESCRIPTION_MAX_LENGTH,
	projectPublicInfoSchema,
	updateProjectPublicInfoRequestSchema,
} from "./project-public-info";

const MAX = PROJECT_DESCRIPTION_MAX_LENGTH;

describe("projectPublicInfoSchema", () => {
	const createValid = (overrides = {}) => ({
		description: "焼きそばを販売します",
		iconFileId: "cjld2cjxh0000qzrmn831i7rn",
		mapImageFileIds: ["cjld2cyuq0000t3rmniod1foy"],
		openStatus: "OPEN",
		stockStatus: "IN_STOCK",
		...overrides,
	});

	it("有効な公開情報を受け入れる", () => {
		expect(projectPublicInfoSchema.safeParse(createValid()).success).toBe(true);
	});

	it("紹介文とアイコンは null を受け入れる", () => {
		const result = projectPublicInfoSchema.safeParse(
			createValid({ description: null, iconFileId: null })
		);
		expect(result.success).toBe(true);
	});

	it("紹介文が上限を超えると拒否する", () => {
		const result = projectPublicInfoSchema.safeParse(
			createValid({ description: "あ".repeat(MAX + 1) })
		);
		expect(result.success).toBe(false);
	});

	it("紹介文がちょうど上限なら受け入れる", () => {
		const result = projectPublicInfoSchema.safeParse(
			createValid({ description: "あ".repeat(MAX) })
		);
		expect(result.success).toBe(true);
	});

	it("紹介文の上限は200文字", () => {
		expect(PROJECT_DESCRIPTION_MAX_LENGTH).toBe(200);
	});

	it("掲載画像が11枚以上だと拒否する", () => {
		const result = projectPublicInfoSchema.safeParse(
			createValid({
				mapImageFileIds: Array.from({ length: 11 }, (_, i) => `file-${i}`),
			})
		);
		expect(result.success).toBe(false);
	});

	it("未知の openStatus を拒否する", () => {
		const result = projectPublicInfoSchema.safeParse(
			createValid({ openStatus: "UNKNOWN" })
		);
		expect(result.success).toBe(false);
	});
});

describe("updateProjectPublicInfoRequestSchema", () => {
	it("空オブジェクトを受け入れる（全項目が変更なし）", () => {
		const result = updateProjectPublicInfoRequestSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it("一部の項目だけの更新を受け入れる", () => {
		const result = updateProjectPublicInfoRequestSchema.safeParse({
			description: "更新後の紹介文",
		});
		expect(result.success).toBe(true);
	});

	it("アイコン削除を意味する空文字を受け入れる", () => {
		const result = updateProjectPublicInfoRequestSchema.safeParse({
			iconFileId: "",
		});
		expect(result.success).toBe(true);
	});

	it("掲載画像の上限を超えると拒否する", () => {
		const result = updateProjectPublicInfoRequestSchema.safeParse({
			mapImageFileIds: Array.from({ length: 11 }, (_, i) => `file-${i}`),
		});
		expect(result.success).toBe(false);
	});

	it("紹介文が上限を超えると拒否する", () => {
		const result = updateProjectPublicInfoRequestSchema.safeParse({
			description: "あ".repeat(MAX + 1),
		});
		expect(result.success).toBe(false);
	});
});
