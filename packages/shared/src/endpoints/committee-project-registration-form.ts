import {
	createProjectRegistrationFormRequestSchema,
	createProjectRegistrationFormResponseSchema,
	deleteProjectRegistrationFormResponseSchema,
	getProjectRegistrationFormDetailResponseSchema,
	listProjectRegistrationFormsResponseSchema,
	projectRegistrationFormAuthorizationPathParamsSchema,
	projectRegistrationFormIdPathParamsSchema,
	requestProjectRegistrationFormAuthorizationRequestSchema,
	requestProjectRegistrationFormAuthorizationResponseSchema,
	updateProjectRegistrationFormAuthorizationRequestSchema,
	updateProjectRegistrationFormAuthorizationResponseSchema,
	updateProjectRegistrationFormRequestSchema,
	updateProjectRegistrationFormResponseSchema,
} from "../schemas/project-registration-form";
import type { BodyEndpoint, GetEndpoint, NoBodyEndpoint } from "./types";

/**
 * POST /committee/project-registration-forms/create
 * 企画登録フォームを作成
 * 権限: PROJECT_REGISTRATION_FORM_CREATE
 */
export const createProjectRegistrationFormEndpoint: BodyEndpoint<
	"POST",
	"/committee/project-registration-forms/create",
	undefined,
	undefined,
	typeof createProjectRegistrationFormRequestSchema,
	typeof createProjectRegistrationFormResponseSchema
> = {
	method: "POST",
	path: "/committee/project-registration-forms/create",
	pathParams: undefined,
	query: undefined,
	request: createProjectRegistrationFormRequestSchema,
	response: createProjectRegistrationFormResponseSchema,
} as const;

/**
 * GET /committee/project-registration-forms
 * 企画登録フォーム一覧を取得（実委人全員が閲覧可）
 */
export const listProjectRegistrationFormsEndpoint: GetEndpoint<
	"/committee/project-registration-forms",
	undefined,
	undefined,
	typeof listProjectRegistrationFormsResponseSchema
> = {
	method: "GET",
	path: "/committee/project-registration-forms",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listProjectRegistrationFormsResponseSchema,
} as const;

/**
 * GET /committee/project-registration-forms/:formId
 * 企画登録フォーム詳細を取得
 */
export const getProjectRegistrationFormDetailEndpoint: GetEndpoint<
	"/committee/project-registration-forms/:formId",
	typeof projectRegistrationFormIdPathParamsSchema,
	undefined,
	typeof getProjectRegistrationFormDetailResponseSchema
> = {
	method: "GET",
	path: "/committee/project-registration-forms/:formId",
	pathParams: projectRegistrationFormIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: getProjectRegistrationFormDetailResponseSchema,
} as const;

/**
 * PATCH /committee/project-registration-forms/:formId
 * 企画登録フォームを更新
 * 権限: PROJECT_REGISTRATION_FORM_CREATE (作成者のみ)
 */
export const updateProjectRegistrationFormEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/project-registration-forms/:formId",
	typeof projectRegistrationFormIdPathParamsSchema,
	undefined,
	typeof updateProjectRegistrationFormRequestSchema,
	typeof updateProjectRegistrationFormResponseSchema
> = {
	method: "PATCH",
	path: "/committee/project-registration-forms/:formId",
	pathParams: projectRegistrationFormIdPathParamsSchema,
	query: undefined,
	request: updateProjectRegistrationFormRequestSchema,
	response: updateProjectRegistrationFormResponseSchema,
} as const;

/**
 * DELETE /committee/project-registration-forms/:formId
 * 企画登録フォームを論理削除
 * 権限: PROJECT_REGISTRATION_FORM_CREATE (作成者のみ)
 */
export const deleteProjectRegistrationFormEndpoint: NoBodyEndpoint<
	"DELETE",
	"/committee/project-registration-forms/:formId",
	typeof projectRegistrationFormIdPathParamsSchema,
	undefined,
	typeof deleteProjectRegistrationFormResponseSchema
> = {
	method: "DELETE",
	path: "/committee/project-registration-forms/:formId",
	pathParams: projectRegistrationFormIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: deleteProjectRegistrationFormResponseSchema,
} as const;

/**
 * POST /committee/project-registration-forms/:formId/authorizations
 * 承認申請
 * 権限: PROJECT_REGISTRATION_FORM_CREATE (作成者のみ)
 */
export const requestProjectRegistrationFormAuthorizationEndpoint: BodyEndpoint<
	"POST",
	"/committee/project-registration-forms/:formId/authorizations",
	typeof projectRegistrationFormIdPathParamsSchema,
	undefined,
	typeof requestProjectRegistrationFormAuthorizationRequestSchema,
	typeof requestProjectRegistrationFormAuthorizationResponseSchema
> = {
	method: "POST",
	path: "/committee/project-registration-forms/:formId/authorizations",
	pathParams: projectRegistrationFormIdPathParamsSchema,
	query: undefined,
	request: requestProjectRegistrationFormAuthorizationRequestSchema,
	response: requestProjectRegistrationFormAuthorizationResponseSchema,
} as const;

/**
 * PATCH /committee/project-registration-forms/:formId/authorizations/:authorizationId
 * 承認・却下
 * 権限: PROJECT_REGISTRATION_FORM_DELIVER (requestedTo のユーザーのみ)
 */
export const updateProjectRegistrationFormAuthorizationEndpoint: BodyEndpoint<
	"PATCH",
	"/committee/project-registration-forms/:formId/authorizations/:authorizationId",
	typeof projectRegistrationFormAuthorizationPathParamsSchema,
	undefined,
	typeof updateProjectRegistrationFormAuthorizationRequestSchema,
	typeof updateProjectRegistrationFormAuthorizationResponseSchema
> = {
	method: "PATCH",
	path: "/committee/project-registration-forms/:formId/authorizations/:authorizationId",
	pathParams: projectRegistrationFormAuthorizationPathParamsSchema,
	query: undefined,
	request: updateProjectRegistrationFormAuthorizationRequestSchema,
	response: updateProjectRegistrationFormAuthorizationResponseSchema,
} as const;
