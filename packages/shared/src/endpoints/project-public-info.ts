import { projectIdPathParamsSchema } from "../schemas/project";
import {
	getProjectPublicInfoResponseSchema,
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
