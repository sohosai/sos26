import { describe, expect, it } from "vitest";
import {
	DEFAULT_MAP_APP_SETTING,
	mapAppSettingSchema,
	updateMapAppSettingRequestSchema,
} from "./map-app-setting";

describe("mapAppSettingSchema", () => {
	it("全項目が揃っていれば受け入れる", () => {
		const result = mapAppSettingSchema.safeParse(DEFAULT_MAP_APP_SETTING);
		expect(result.success).toBe(true);
	});

	it("項目が欠けていると拒否する", () => {
		const { isIconEditable: _omitted, ...partial } = DEFAULT_MAP_APP_SETTING;
		expect(mapAppSettingSchema.safeParse(partial).success).toBe(false);
	});

	it("boolean 以外を拒否する", () => {
		const result = mapAppSettingSchema.safeParse({
			...DEFAULT_MAP_APP_SETTING,
			isIconEditable: "true",
		});
		expect(result.success).toBe(false);
	});
});

describe("DEFAULT_MAP_APP_SETTING", () => {
	// Prisma スキーマの @default と一致していること
	it("開店・在庫状態の編集は既定で無効", () => {
		expect(DEFAULT_MAP_APP_SETTING.isOpenStatusEditable).toBe(false);
		expect(DEFAULT_MAP_APP_SETTING.isStockStatusEditable).toBe(false);
	});

	it("紹介文・アイコン・掲載画像の編集は既定で有効", () => {
		expect(DEFAULT_MAP_APP_SETTING.isDescriptionEditable).toBe(true);
		expect(DEFAULT_MAP_APP_SETTING.isIconEditable).toBe(true);
		expect(DEFAULT_MAP_APP_SETTING.isMapImagesEditable).toBe(true);
	});
});

describe("updateMapAppSettingRequestSchema", () => {
	it("一部の項目だけの更新を受け入れる", () => {
		const result = updateMapAppSettingRequestSchema.safeParse({
			isIconEditable: false,
		});
		expect(result.success).toBe(true);
	});

	it("空オブジェクトを受け入れる", () => {
		expect(updateMapAppSettingRequestSchema.safeParse({}).success).toBe(true);
	});

	it("未知のキーは無視される", () => {
		const result = updateMapAppSettingRequestSchema.safeParse({
			isIconEditable: false,
			unknownKey: true,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ isIconEditable: false });
		}
	});
});
