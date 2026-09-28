import { z } from "zod";
import { projectLocationSchema, projectTypeSchema } from "./common";
import { projectDeletionStatusSchema } from "./project";
import {
	projectPublicInfoFieldSchema,
	projectPublicInfoModerationKindSchema,
	projectPublicInfoSchema,
	updateProjectPublicInfoRequestSchema,
} from "./project-public-info";

export const committeePublicInfoModerationSchema = z.object({
	field: projectPublicInfoFieldSchema,
	kind: projectPublicInfoModerationKindSchema,
	updatedBy: z.object({ id: z.string(), name: z.string() }),
	updatedAt: z.coerce.date(),
});
export type CommitteePublicInfoModeration = z.infer<
	typeof committeePublicInfoModerationSchema
>;

export const committeePublicInfoItemSchema = z.object({
	project: z.object({
		id: z.string(),
		number: z.number().int(),
		name: z.string(),
		organizationName: z.string(),
		type: projectTypeSchema,
		location: projectLocationSchema,
		deletionStatus: projectDeletionStatusSchema.nullable(),
	}),
	// 登録値（企画情報が未登録なら null）
	publicInfo: projectPublicInfoSchema.nullable(),
	moderations: z.array(committeePublicInfoModerationSchema),
	hiddenMapImageFileIds: z.array(z.string()),
});
export type CommitteePublicInfoItem = z.infer<
	typeof committeePublicInfoItemSchema
>;

export const committeePublicInfoItemResponseSchema = z.object({
	item: committeePublicInfoItemSchema,
});
export type CommitteePublicInfoItemResponse = z.infer<
	typeof committeePublicInfoItemResponseSchema
>;

// GET /committee/public-info
export const listCommitteePublicInfoResponseSchema = z.object({
	items: z.array(committeePublicInfoItemSchema),
});
export type ListCommitteePublicInfoResponse = z.infer<
	typeof listCommitteePublicInfoResponseSchema
>;

// PUT/DELETE /committee/public-info/:projectId/hidden/:field
export const committeePublicInfoFieldPathParamsSchema = z.object({
	projectId: z.string().min(1),
	field: projectPublicInfoFieldSchema,
});

export const hideCommitteePublicInfoFieldRequestSchema = z.object({});

// PATCH /committee/public-info/:projectId
export const correctCommitteePublicInfoRequestSchema =
	updateProjectPublicInfoRequestSchema.pick({
		description: true,
		websiteUrls: true,
		xIds: true,
		instagramIds: true,
		youtubeIds: true,
	});
export type CorrectCommitteePublicInfoRequest = z.infer<
	typeof correctCommitteePublicInfoRequestSchema
>;

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
