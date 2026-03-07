import {
	getActiveProjectRegistrationFormsQuerySchema,
	getActiveProjectRegistrationFormsResponseSchema,
} from "../schemas/project-registration-form";
import type { GetEndpoint } from "./types";

/**
 * GET /project/registration-forms
 * 有効な企画登録フォーム一覧を取得（type/locationでフィルタ）
 * 企画登録のページ2以降に使用
 */
export const getActiveProjectRegistrationFormsEndpoint: GetEndpoint<
	"/project/registration-forms",
	undefined,
	typeof getActiveProjectRegistrationFormsQuerySchema,
	typeof getActiveProjectRegistrationFormsResponseSchema
> = {
	method: "GET",
	path: "/project/registration-forms",
	pathParams: undefined,
	query: getActiveProjectRegistrationFormsQuerySchema,
	request: undefined,
	response: getActiveProjectRegistrationFormsResponseSchema,
} as const;
