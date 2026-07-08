import { z } from "zod";

export const openStatusSchema = z.enum(["OPEN", "CLOSED", "NOT_APPLICABLE"]);
export type OpenStatus = z.infer<typeof openStatusSchema>;

export const stockStatusSchema = z.enum([
	"IN_STOCK",
	"OUT_OF_STOCK",
	"NOT_APPLICABLE",
]);
export type StockStatus = z.infer<typeof stockStatusSchema>;

export const projectPublicInfoSchema = z.object({
	description: z.string().max(400).nullable(),
	iconFileId: z.string().nullable(),
	mapImageFileIds: z.array(z.string()).max(10),
	openStatus: openStatusSchema,
	stockStatus: stockStatusSchema,
});

export type ProjectPublicInfo = z.infer<typeof projectPublicInfoSchema>;

// GET /project/:projectId/public-info
export const getProjectPublicInfoResponseSchema = z.object({
	publicInfo: projectPublicInfoSchema.nullable(),
});
export type GetProjectPublicInfoResponse = z.infer<
	typeof getProjectPublicInfoResponseSchema
>;

// PUT /project/:projectId/public-info
export const updateProjectPublicInfoRequestSchema = z.object({
	description: z.string().max(400).nullable().optional(),
	iconFileId: z.string().nullable().optional(),
	mapImageFileIds: z.array(z.string()).max(10).optional(),
	openStatus: openStatusSchema.optional(),
	stockStatus: stockStatusSchema.optional(),
});
export type UpdateProjectPublicInfoRequest = z.infer<
	typeof updateProjectPublicInfoRequestSchema
>;

export const updateProjectPublicInfoResponseSchema = z.object({
	publicInfo: projectPublicInfoSchema,
});
export type UpdateProjectPublicInfoResponse = z.infer<
	typeof updateProjectPublicInfoResponseSchema
>;
