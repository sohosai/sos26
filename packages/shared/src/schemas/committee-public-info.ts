import { z } from "zod";
import {
	committeeProjectPublicInfoSchema,
	hideableProjectPublicInfoFieldSchema,
	projectPublicInfoFieldSchema,
	updateProjectPublicInfoRequestSchema,
} from "./project-public-info";

// 非表示・修正の操作のレスポンス
export const committeePublicInfoItemResponseSchema = z.object({
	project: committeeProjectPublicInfoSchema,
});
export type CommitteePublicInfoItemResponse = z.infer<
	typeof committeePublicInfoItemResponseSchema
>;

// PUT/DELETE /committee/public-info/:projectId/hidden/:field
export const committeePublicInfoFieldPathParamsSchema = z.object({
	projectId: z.string().min(1),
	field: hideableProjectPublicInfoFieldSchema,
});

export const hideCommitteePublicInfoFieldRequestSchema = z.object({});

// PATCH /committee/public-info/:projectId
export const correctCommitteePublicInfoRequestSchema =
	updateProjectPublicInfoRequestSchema.pick({
		description: true,
		iconFileId: true,
		mapImageFileIds: true,
		websiteUrls: true,
		xIds: true,
		instagramIds: true,
		youtubeIds: true,
	});
export type CorrectCommitteePublicInfoRequest = z.infer<
	typeof correctCommitteePublicInfoRequestSchema
>;

// DELETE /committee/public-info/:projectId/corrections/:field
export const committeePublicInfoCorrectionPathParamsSchema = z.object({
	projectId: z.string().min(1),
	field: projectPublicInfoFieldSchema,
});

// PUT /committee/public-info/:projectId/map-images/:fileId
export const committeePublicInfoMapImagePathParamsSchema = z.object({
	projectId: z.string().min(1),
	fileId: z.string().min(1),
});

export const updateCommitteePublicInfoMapImageRequestSchema = z.object({
	isHidden: z.boolean(),
});
export type UpdateCommitteePublicInfoMapImageRequest = z.infer<
	typeof updateCommitteePublicInfoMapImageRequestSchema
>;
