import { queryOptions } from "@tanstack/react-query";
import { listMyForms } from "../api/committee-form";
import { listCommitteeMembersPicker } from "../api/committee-member";
import { listCommitteeProjects } from "../api/committee-project";

/** 担当者の候補などに使う一覧。ほかの委員の操作で変わっても、60 秒までは古いまま使う */
const PICKER_STALE_TIME = 60_000;

export const committeeQueryKeys = {
	membersPicker: ["committee", "members", "picker"],
	myForms: ["committee", "forms", "mine"],
	allProjects: ["committee", "projects", "all"],
} as const;

export const committeeMembersPickerQuery = queryOptions({
	queryKey: committeeQueryKeys.membersPicker,
	queryFn: () => listCommitteeMembersPicker(),
	staleTime: PICKER_STALE_TIME,
});

export const myFormsQuery = queryOptions({
	queryKey: committeeQueryKeys.myForms,
	queryFn: () => listMyForms(),
	staleTime: PICKER_STALE_TIME,
});

export const allCommitteeProjectsQuery = queryOptions({
	queryKey: committeeQueryKeys.allProjects,
	queryFn: () => listCommitteeProjects(),
	staleTime: PICKER_STALE_TIME,
});
