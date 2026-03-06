import {
	type GetActiveProjectRegistrationFormsResponse,
	getActiveProjectRegistrationFormsEndpoint,
	type ProjectLocation,
	type ProjectType,
} from "@sos26/shared";
import { callGetApi } from "./core";

/**
 * GET /project/registration-forms
 * 有効な企画登録フォーム一覧を取得（type/locationでフィルタ）
 */
export async function getActiveProjectRegistrationForms(
	type: ProjectType,
	location: ProjectLocation
): Promise<GetActiveProjectRegistrationFormsResponse> {
	return callGetApi(getActiveProjectRegistrationFormsEndpoint, {
		query: { type, location },
	});
}
