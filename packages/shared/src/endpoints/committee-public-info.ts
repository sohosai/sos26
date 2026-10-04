import {
	committeePublicInfoFieldPathParamsSchema,
	committeePublicInfoItemResponseSchema,
	committeePublicInfoMapImagePathParamsSchema,
	correctCommitteePublicInfoRequestSchema,
	hideCommitteePublicInfoFieldRequestSchema,
	updateCommitteePublicInfoMapImageRequestSchema,
} from "../schemas/committee-public-info";
import { projectIdPathParamsSchema } from "../schemas/project";
import type { BodyEndpoint, NoBodyEndpoint } from "./types";

/**
 * PUT /committee/public-info/:projectId/hidden/:field
 * 項目を非表示にする
 */
export const hideCommitteePublicInfoFieldEndpoint: BodyEndpoint<
	"PUT",
	"/committee/public-info/:projectId/hidden/:field",
	typeof committeePublicInfoFieldPathParamsSchema,
	undefined,
	typeof hideCommitteePublicInfoFieldRequestSchema,
	typeof committeePublicInfoItemResponseSchema
> = {
	method: "PUT",
	path: "/committee/public-info/:projectId/hidden/:field",
	pathParams: committeePublicInfoFieldPathParamsSchema,
	query: undefined,
	request: hideCommitteePublicInfoFieldRequestSchema,
	response: committeePublicInfoItemResponseSchema,
} as const;

/**
 * DELETE /committee/public-info/:projectId/hidden/:field
 * 項目の非表示を解除する
 */
export const unhideCommitteePublicInfoFieldEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/public-info/:projectId/hidden/:field",
	typeof committeePublicInfoFieldPathParamsSchema,
	undefined,
	typeof committeePublicInfoItemResponseSchema
> = {
	method: "DELETE",
	path: "/committee/public-info/:projectId/hidden/:field",
	pathParams: committeePublicInfoFieldPathParamsSchema,
	query: undefined,
	request: undefined,
	response: committeePublicInfoItemResponseSchema,
} as const;

/**
 * PATCH /committee/public-info/:projectId
 * 登録値を修正する
 */
export const correctCommitteePublicInfoEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/public-info/:projectId",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof correctCommitteePublicInfoRequestSchema,
	typeof committeePublicInfoItemResponseSchema
> = {
	method: "PATCH",
	path: "/committee/public-info/:projectId",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: correctCommitteePublicInfoRequestSchema,
	response: committeePublicInfoItemResponseSchema,
} as const;

/**
 * PUT /committee/public-info/:projectId/map-images/:fileId
 * 掲載画像の非表示を切り替える
 */
export const updateCommitteePublicInfoMapImageEndpoint: BodyEndpoint<
	"PUT",
	"/committee/public-info/:projectId/map-images/:fileId",
	typeof committeePublicInfoMapImagePathParamsSchema,
	undefined,
	typeof updateCommitteePublicInfoMapImageRequestSchema,
	typeof committeePublicInfoItemResponseSchema
> = {
	method: "PUT",
	path: "/committee/public-info/:projectId/map-images/:fileId",
	pathParams: committeePublicInfoMapImagePathParamsSchema,
	query: undefined,
	request: updateCommitteePublicInfoMapImageRequestSchema,
	response: committeePublicInfoItemResponseSchema,
} as const;
