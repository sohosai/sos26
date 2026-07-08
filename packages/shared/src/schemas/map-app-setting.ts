import { z } from "zod";

export const mapAppSettingSchema = z.object({
	isDescriptionEditable: z.boolean(),
	isIconEditable: z.boolean(),
	isMapImagesEditable: z.boolean(),
	isOpenStatusEditable: z.boolean(),
	isStockStatusEditable: z.boolean(),
});

export type MapAppSetting = z.infer<typeof mapAppSettingSchema>;

// GET /committee/map-settings
export const getMapAppSettingResponseSchema = z.object({
	setting: mapAppSettingSchema,
});
export type GetMapAppSettingResponse = z.infer<
	typeof getMapAppSettingResponseSchema
>;

// PUT /committee/map-settings
export const updateMapAppSettingRequestSchema = mapAppSettingSchema.partial();
export type UpdateMapAppSettingRequest = z.infer<
	typeof updateMapAppSettingRequestSchema
>;

export const updateMapAppSettingResponseSchema = z.object({
	setting: mapAppSettingSchema,
});
export type UpdateMapAppSettingResponse = z.infer<
	typeof updateMapAppSettingResponseSchema
>;
