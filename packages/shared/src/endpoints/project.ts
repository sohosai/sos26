import {
	createProjectRequestSchema,
	createProjectResponseSchema,
} from "../schemas/project";
import type { BodyEndpoint } from "./types";

/**
 * POST /projects
 * 企画を作成
 *
 * - 認証必須
 * - ownerId のユーザーが存在すること
 * - subOwnerId は任意
 * - inviteCode は自動生成
 */
export const createProjectEndpoint: BodyEndpoint<
	"POST",
	"/projects",
	undefined,
	undefined,
	typeof createProjectRequestSchema,
	typeof createProjectResponseSchema
> = {
	method: "POST",
	path: "/projects",
	pathParams: undefined,
	query: undefined,
	request: createProjectRequestSchema,
	response: createProjectResponseSchema,
} as const;
