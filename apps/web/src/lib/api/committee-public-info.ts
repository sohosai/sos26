import type {
	CommitteePublicInfoItemResponse,
	CorrectCommitteePublicInfoRequest,
	HideableProjectPublicInfoField,
	ProjectPublicInfoField,
} from "@sos26/shared";
import {
	correctCommitteePublicInfoEndpoint,
	hideCommitteePublicInfoFieldEndpoint,
	revertCommitteePublicInfoCorrectionEndpoint,
	unhideCommitteePublicInfoFieldEndpoint,
	updateCommitteePublicInfoMapImageEndpoint,
} from "@sos26/shared";
import { callBodyApi, callNoBodyApi } from "./core";

export async function hideCommitteePublicInfoField(
	projectId: string,
	field: HideableProjectPublicInfoField
): Promise<CommitteePublicInfoItemResponse> {
	return callBodyApi(
		hideCommitteePublicInfoFieldEndpoint,
		{},
		{ pathParams: { projectId, field } }
	);
}

export async function unhideCommitteePublicInfoField(
	projectId: string,
	field: HideableProjectPublicInfoField
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

export async function revertCommitteePublicInfoCorrection(
	projectId: string,
	field: ProjectPublicInfoField
): Promise<CommitteePublicInfoItemResponse> {
	return callNoBodyApi(revertCommitteePublicInfoCorrectionEndpoint, {
		pathParams: { projectId, field },
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
