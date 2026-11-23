import { type QueryKey, queryOptions } from "@tanstack/react-query";
import {
	getProjectNotificationStatus,
	listProjectMembers,
} from "../api/project";
import { listProjectForms } from "../api/project-form";
import { listProjectInquiries } from "../api/project-inquiry";
import { listProjectNotices } from "../api/project-notice";
import { queryClient } from "./client";

/**
 * /project の中で画面を移るたびには一覧を取り直さない。
 * 新着は、画面を移るたびと定期的に notification-status を確かめ、変わっていたら取り直す
 */
const PROJECT_STALE_TIME = 30_000;

export const projectQueryKeys = {
	/** 企画ごとの query をまとめて無効にするときに使う */
	all: (projectId: string) => ["project", projectId] as const,
	notificationStatus: (projectId: string) =>
		["project", projectId, "notification-status"] as const,
	forms: (projectId: string) => ["project", projectId, "forms"] as const,
	notices: (projectId: string) => ["project", projectId, "notices"] as const,
	inquiries: (projectId: string) =>
		["project", projectId, "inquiries"] as const,
	members: (projectId: string) => ["project", projectId, "members"] as const,
};

export const projectNotificationStatusQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.notificationStatus(projectId),
		queryFn: () => getProjectNotificationStatus(projectId),
		staleTime: PROJECT_STALE_TIME,
		// 前回の値と比べて新着を見つけるので、タブを長く離れていてもキャッシュから消さない
		gcTime: Number.POSITIVE_INFINITY,
	});

export const projectFormsQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.forms(projectId),
		queryFn: () => listProjectForms(projectId),
		staleTime: PROJECT_STALE_TIME,
	});

export const projectNoticesQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.notices(projectId),
		queryFn: () => listProjectNotices(projectId),
		staleTime: PROJECT_STALE_TIME,
	});

export const projectInquiriesQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.inquiries(projectId),
		queryFn: () => listProjectInquiries(projectId),
		staleTime: PROJECT_STALE_TIME,
	});

export const projectMembersQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.members(projectId),
		queryFn: () => listProjectMembers(projectId),
		staleTime: PROJECT_STALE_TIME,
	});

/**
 * 一覧のキャッシュがまだ新しいときだけ、/project の beforeLoad が始めた新着の確認を待つ。
 * 新着があれば確認がキャッシュを古くするので、待ってから読めば取り直される。
 * キャッシュが古いときや無いときは、待たずに取得すればよい
 */
export async function waitForNotificationStatusCheck(
	check: Promise<void>,
	listQueryKeys: QueryKey[]
): Promise<void> {
	const hasFreshCache = listQueryKeys.some(queryKey => {
		const state = queryClient.getQueryState(queryKey);
		return (
			state?.data !== undefined &&
			!state.isInvalidated &&
			Date.now() - state.dataUpdatedAt < PROJECT_STALE_TIME
		);
	});
	if (hasFreshCache) await check;
}
