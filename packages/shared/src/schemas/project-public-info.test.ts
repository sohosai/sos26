import { describe, expect, it } from "vitest";
import {
	PROJECT_DESCRIPTION_MAX_LENGTH,
	PROJECT_INSTAGRAM_ID_MAX_LENGTH,
	PROJECT_SNS_URL_MAX_LENGTH,
	PROJECT_X_ID_MAX_LENGTH,
	PROJECT_YOUTUBE_ID_MAX_LENGTH,
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
		websiteUrl: "https://example.com",
		xId: "sohosai",
		instagramId: null,
		youtubeId: null,
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

	it("http(s) 以外のSNSリンクを拒否する", () => {
		const result = projectPublicInfoSchema.safeParse(
			createValid({ websiteUrl: "javascript:alert(1)" })
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

	it("SNSリンク削除を意味する空文字を受け入れる", () => {
		const result = updateProjectPublicInfoRequestSchema.safeParse({
			websiteUrl: "",
			xId: "",
			instagramId: "",
			youtubeId: "",
		});
		expect(result.success).toBe(true);
	});

	it("URLでないWebサイトを拒否する", () => {
		const result = updateProjectPublicInfoRequestSchema.safeParse({
			websiteUrl: "sohosai",
		});
		expect(result.success).toBe(false);
	});

	it("X・Instagram の先頭の @ を外して受け入れる", () => {
		const result = updateProjectPublicInfoRequestSchema.parse({
			xId: "@sohosai",
			instagramId: "@soho.sai_26",
		});
		expect(result.xId).toBe("sohosai");
		expect(result.instagramId).toBe("soho.sai_26");
	});

	it("X・Instagram に URL を入れると拒否する", () => {
		expect(
			updateProjectPublicInfoRequestSchema.safeParse({
				xId: "https://x.com/sohosai",
			}).success
		).toBe(false);
		expect(
			updateProjectPublicInfoRequestSchema.safeParse({
				instagramId: "https://www.instagram.com/sohosai",
			}).success
		).toBe(false);
	});

	it("X・Instagram の ID が上限を超えると拒否する", () => {
		expect(
			updateProjectPublicInfoRequestSchema.safeParse({
				xId: "a".repeat(PROJECT_X_ID_MAX_LENGTH + 1),
			}).success
		).toBe(false);
		expect(
			updateProjectPublicInfoRequestSchema.safeParse({
				instagramId: "a".repeat(PROJECT_INSTAGRAM_ID_MAX_LENGTH + 1),
			}).success
		).toBe(false);
	});

	it("@ だけの ID を拒否する", () => {
		const result = updateProjectPublicInfoRequestSchema.safeParse({
			xId: "@",
		});
		expect(result.success).toBe(false);
	});

	it("SNSリンクが上限を超えると拒否する", () => {
		const result = updateProjectPublicInfoRequestSchema.safeParse({
			websiteUrl: `https://example.com/${"a".repeat(PROJECT_SNS_URL_MAX_LENGTH)}`,
		});
		expect(result.success).toBe(false);
	});

	it("YouTube のハンドルは日本語を含めて受け入れ、先頭の @ を外す", () => {
		const result = updateProjectPublicInfoRequestSchema.parse({
			youtubeId: "@雙峰祭_sohosai.26",
		});
		expect(result.youtubeId).toBe("雙峰祭_sohosai.26");
	});

	it("YouTube に URL や短すぎるハンドルを入れると拒否する", () => {
		for (const youtubeId of [
			"https://www.youtube.com/@sohosai",
			"ab",
			"あ",
			"ア",
			"a".repeat(PROJECT_YOUTUBE_ID_MAX_LENGTH + 1),
		]) {
			expect(
				updateProjectPublicInfoRequestSchema.safeParse({ youtubeId }).success,
				youtubeId
			).toBe(false);
		}
	});

	it.each([
		"祭",
		"雙峰",
		"あい",
		"アイ",
		"カー",
		"お茶",
		"𠮷",
		"한",
	])("短い日本語などのYouTubeハンドル %s を保存・取得できる", youtubeId => {
		const result = updateProjectPublicInfoRequestSchema.parse({
			youtubeId: `@${youtubeId}`,
		});
		expect(result.youtubeId).toBe(youtubeId);
		expect(
			projectPublicInfoSchema.shape.youtubeId.safeParse(result.youtubeId)
				.success
		).toBe(true);
	});
});
