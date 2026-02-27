import {
	createFormResponseRequestSchema,
	createFormResponseResponseSchema,
	getProjectFormResponseSchema,
	listProjectFormsResponseSchema,
	projectFormPathParamsSchema,
	projectFormResponsePathParamsSchema,
	updateFormResponseRequestSchema,
	updateFormResponseResponseSchema,
} from "../schemas/form";
import { projectIdPathParamsSchema } from "../schemas/project";
import type { BodyEndpoint, GetEndpoint } from "./types";

// ─────────────────────────────────────────────────────────────
// 企画側: /project/:projectId/forms
// ─────────────────────────────────────────────────────────────

/**
 * GET /project/:projectId/forms
 * 配信されたフォーム一覧
 */
export const listProjectFormsEndpoint: GetEndpoint<
	"/project/:projectId/forms",
	typeof projectIdPathParamsSchema,
	undefined,
	typeof listProjectFormsResponseSchema
> = {
	method: "GET",
	path: "/project/:projectId/forms",
	pathParams: projectIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: listProjectFormsResponseSchema,
} as const;

/**
 * GET /project/:projectId/forms/:formDeliveryId
 * フォーム詳細 + 自分の回答
 */
export const getProjectFormEndpoint: GetEndpoint<
	"/project/:projectId/forms/:formDeliveryId",
	typeof projectFormPathParamsSchema,
	undefined,
	typeof getProjectFormResponseSchema
> = {
	method: "GET",
	path: "/project/:projectId/forms/:formDeliveryId",
	pathParams: projectFormPathParamsSchema,
	query: undefined,
	request: undefined,
	response: getProjectFormResponseSchema,
} as const;

/**
 * POST /project/:projectId/forms/:formDeliveryId/responses
 * 回答を作成（下書き or 提出）
 */
export const createFormResponseEndpoint: BodyEndpoint<
	"POST",
	"/project/:projectId/forms/:formDeliveryId/responses",
	typeof projectFormPathParamsSchema,
	undefined,
	typeof createFormResponseRequestSchema,
	typeof createFormResponseResponseSchema
> = {
	method: "POST",
	path: "/project/:projectId/forms/:formDeliveryId/responses",
	pathParams: projectFormPathParamsSchema,
	query: undefined,
	request: createFormResponseRequestSchema,
	response: createFormResponseResponseSchema,
} as const;

/**
 * PATCH /project/:projectId/forms/:formDeliveryId/responses/:responseId
 * 回答を更新（下書き編集 or 提出）
 */
export const updateFormResponseEndpoint: BodyEndpoint<
	"PATCH",
	"/project/:projectId/forms/:formDeliveryId/responses/:responseId",
	typeof projectFormResponsePathParamsSchema,
	undefined,
	typeof updateFormResponseRequestSchema,
	typeof updateFormResponseResponseSchema
> = {
	method: "PATCH",
	path: "/project/:projectId/forms/:formDeliveryId/responses/:responseId",
	pathParams: projectFormResponsePathParamsSchema,
	query: undefined,
	request: updateFormResponseRequestSchema,
	response: updateFormResponseResponseSchema,
} as const;
