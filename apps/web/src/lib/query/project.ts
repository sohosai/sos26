import {
	type FetchQueryOptions,
	type QueryKey,
	queryOptions,
} from "@tanstack/react-query";
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

/**
 * 一覧はキャッシュから消さない。ルーターは離れた画面の loader の結果を持ち続け、再訪するとその結果ですぐに描画する。
 * そのとき一覧のキャッシュが消えていると、取得が終わるまで画面が表示されない
 */
const PROJECT_LIST_GC_TIME = Number.POSITIVE_INFINITY;

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
		gcTime: PROJECT_LIST_GC_TIME,
	});

export const projectNoticesQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.notices(projectId),
		queryFn: () => listProjectNotices(projectId),
		staleTime: PROJECT_STALE_TIME,
		gcTime: PROJECT_LIST_GC_TIME,
	});

export const projectInquiriesQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.inquiries(projectId),
		queryFn: () => listProjectInquiries(projectId),
		staleTime: PROJECT_STALE_TIME,
		gcTime: PROJECT_LIST_GC_TIME,
	});

export const projectMembersQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.members(projectId),
		queryFn: () => listProjectMembers(projectId),
		staleTime: PROJECT_STALE_TIME,
		gcTime: PROJECT_LIST_GC_TIME,
	});

function hasFreshCache(queryKey: QueryKey): boolean {
	const state = queryClient.getQueryState(queryKey);
	return (
		state?.data !== undefined &&
		!state.isInvalidated &&
		Date.now() - state.dataUpdatedAt < PROJECT_STALE_TIME
	);
}

/**
 * 一覧を取得する。キャッシュがまだ新しいときだけ、/project の beforeLoad が始めた新着の確認を待ってから読む。
 * 新着があれば確認がキャッシュを古くするので、待ってから読めば取り直される。
 * キャッシュが古いときや無いときは、確認を待たずに取得する
 */
export async function fetchProjectListQuery<TData, TQueryKey extends QueryKey>(
	notificationStatusCheck: Promise<void>,
	options: FetchQueryOptions<TData, Error, TData, TQueryKey>
): Promise<TData> {
	if (hasFreshCache(options.queryKey)) await notificationStatusCheck;
	return queryClient.fetchQuery(options);
}

/**
 * query を無効にする。取得中なら、その取得の終わりを待ってから無効にする。
 * 取得中に無効にすると、その取得の成功で無効が打ち消されるため
 */
export async function invalidateQueryAfterFetch(
	queryKey: QueryKey
): Promise<void> {
	const query = queryClient.getQueryCache().find({ queryKey, exact: true });
	if (query?.state.fetchStatus === "fetching") {
		await query.promise?.catch(() => undefined);
	}
	await queryClient.invalidateQueries({ queryKey, exact: true });
}
