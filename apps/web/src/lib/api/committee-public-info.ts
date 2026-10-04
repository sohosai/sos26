import type {
	CommitteePublicInfoItemResponse,
	CorrectCommitteePublicInfoRequest,
	ProjectPublicInfoField,
} from "@sos26/shared";
import {
	correctCommitteePublicInfoEndpoint,
	hideCommitteePublicInfoFieldEndpoint,
	unhideCommitteePublicInfoFieldEndpoint,
	updateCommitteePublicInfoMapImageEndpoint,
} from "@sos26/shared";
import { callBodyApi, callNoBodyApi } from "./core";

export async function hideCommitteePublicInfoField(
	projectId: string,
	field: ProjectPublicInfoField
): Promise<CommitteePublicInfoItemResponse> {
	return callBodyApi(
		hideCommitteePublicInfoFieldEndpoint,
		{},
		{ pathParams: { projectId, field } }
	);
}

export async function unhideCommitteePublicInfoField(
	projectId: string,
	field: ProjectPublicInfoField
): Promise<CommitteePublicInfoItemResponse> {
	return callNoBodyApi(unhideCommitteePublicInfoFieldEndpoint, {
		pathParams: { projectId, field },
	});
}

export async function correctCommitteePublicInfo(
	projectId: string,
	data: CorrectCommitteePublicInfoRequest
): Promise<CommitteePublicInfoItemResponse> {
	return callBodyApi(correctCommitteePublicInfoEndpoint, data, {
		pathParams: { projectId },
	});
}

export async function updateCommitteePublicInfoMapImage(
	projectId: string,
	fileId: string,
	isHidden: boolean
): Promise<CommitteePublicInfoItemResponse> {
	return callBodyApi(
		updateCommitteePublicInfoMapImageEndpoint,
		{ isHidden },
		{ pathParams: { projectId, fileId } }
	);
}
