import { projectIdPathParamsSchema } from "../schemas/project";
import {
	getProjectPublicInfoResponseSchema,
	listCommitteeProjectPublicInfosResponseSchema,
	updateProjectPublicInfoRequestSchema,
	updateProjectPublicInfoResponseSchema,
} from "../schemas/project-public-info";
import type { BodyEndpoint, GetEndpoint } from "./types";

export const getProjectPublicInfoEndpoint: GetEndpoint<
	"/project/:projectId/public-info",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof getProjectPublicInfoResponseSchema
> = {
	method: "GET",
	path: "/project/:projectId/public-info",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: getProjectPublicInfoResponseSchema,
} as const;

export const updateProjectPublicInfoEndpoint: BodyEndpoint<
	"PUT",
	"/project/:projectId/public-info",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof updateProjectPublicInfoRequestSchema,
	typeof updateProjectPublicInfoResponseSchema
> = {
	method: "PUT",
	path: "/project/:projectId/public-info",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: updateProjectPublicInfoRequestSchema,
	response: updateProjectPublicInfoResponseSchema,
} as const;

/**
 * GET /committee/projects/public-infos
 * 有効な全企画の企画情報一覧（未入力の企画は publicInfo が null）
 *
 * - 認証 + 実委メンバー必須
 */
export const listCommitteeProjectPublicInfosEndpoint: GetEndpoint<
	"/committee/projects/public-infos",
	undefined,
	undefined,
	typeof listCommitteeProjectPublicInfosResponseSchema
> = {
	method: "GET",
	path: "/committee/projects/public-infos",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listCommitteeProjectPublicInfosResponseSchema,
} as const;
