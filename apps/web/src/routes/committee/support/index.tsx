import type {
	CommitteeInquiryListView,
	ListCommitteeInquiriesResponse,
} from "@sos26/shared";
import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { NewInquiryForm } from "@/components/support/NewInquiryForm";
import {
	type CommitteeInquiryLists,
	type CommitteeTab,
	type PagedView,
	SupportList,
} from "@/components/support/SupportList";
import { listMyForms } from "@/lib/api/committee-form";
import {
	createCommitteeInquiry,
	listCommitteeInquiries,
} from "@/lib/api/committee-inquiry";
import { listCommitteeMembersPicker } from "@/lib/api/committee-member";
import {
	listCommitteeProjectMembers,
	listCommitteeProjects,
} from "@/lib/api/committee-project";
import { useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

const searchSchema = z.object({
	tab: z.enum(["open", "draft", "resolved"]).catch("open"),
});

export const Route = createFileRoute("/committee/support/")({
	validateSearch: searchSchema,
	component: CommitteeSupportListPage,
	head: () => ({
		meta: [
			{ title: "お問い合わせ | 雙峰祭オンラインシステム" },
			{ name: "description", content: "お問い合わせ管理" },
		],
	}),
	loader: async () => {
		const { committeeMember } = useAuthStore.getState();

		const [projectsRes, membersRes, formsRes] = await Promise.all([
			listCommitteeProjects(),
			listCommitteeMembersPicker(),
			listMyForms(),
		]);

		return {
			projects: projectsRes.projects.map(p => ({
				id: p.id,
				name: p.name,
				number: p.number,
			})),
			committeeMembers: membersRes.committeeMembers.map(m => ({
				id: m.user.id,
				name: m.user.name,
				avatarFileId: m.user.avatarFileId,
			})),
			availableForms: formsRes.forms
				.filter(
					f =>
						f.owner.id === committeeMember?.userId ||
						f.collaborators.some(c => c.id === committeeMember?.userId)
				)
				.map(f => ({
					id: f.id,
					title: f.title,
				})),
		};
	},
});

function CommitteeSupportListPage() {
	const { tab } = Route.useSearch();
	const { projects, committeeMembers, availableForms } = Route.useLoaderData();
	const [formOpen, setFormOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [onlyUnreplied, setOnlyUnreplied] = useState(false);
	const search = useDebouncedValue(searchQuery.trim(), SEARCH_DEBOUNCE_MS);
	const { user } = useAuthStore();
	const { lists, badgeCounts, loadFailed, loadMore, loadingMoreView } =
		useCommitteeInquiryLists({
			userId: user?.id ?? "",
			tab,
			search,
			onlyUnreplied,
		});
	const navigate = useNavigate();
	const router = useRouter();

	if (!user) return null;

	const currentUser = { id: user.id, name: user.name };

	const handleLoadProjectMembers = async (projectId: string) => {
		const res = await listCommitteeProjectMembers(projectId);
		return res.members.map(m => ({
			id: m.userId,
			name: m.name,
			role: m.role,
			avatarFileId: m.avatarFileId,
		}));
	};

	return (
		<>
			<SupportList
				currentUser={currentUser}
				viewerRole="committee"
				basePath="/committee/support"
				onNewInquiry={() => setFormOpen(true)}
				committee={{
					activeTab: tab,
					onTabChange: nextTab => {
						navigate({
							to: ".",
							search: prev => ({ ...prev, tab: nextTab }),
							replace: true,
						});
					},
					lists,
					badgeCounts,
					loadFailed,
					searchQuery,
					onSearchQueryChange: setSearchQuery,
					onlyUnreplied,
					onOnlyUnrepliedChange: setOnlyUnreplied,
					onLoadMore: loadMore,
					loadingMoreView,
				}}
			/>
			<NewInquiryForm
				open={formOpen}
				onOpenChange={setFormOpen}
				viewerRole="committee"
				currentUser={currentUser}
				projects={projects}
				onLoadProjectMembers={handleLoadProjectMembers}
				committeeMembers={committeeMembers}
				availableForms={availableForms}
				onSubmit={async params => {
					if (!params.projectId || !params.projectAssigneeUserIds) return;
					const { inquiry } = await createCommitteeInquiry({
						title: params.title,
						body: params.body,
						relatedFormId: params.relatedFormId ?? undefined,
						projectId: params.projectId,
						projectAssigneeUserIds: params.projectAssigneeUserIds,
						committeeAssigneeUserIds: params.committeeAssigneeUserIds,
						fileIds: params.fileIds,
						viewers: params.viewers,
						isDraft: params.isDraft,
					});
					await router.invalidate();
					navigate({
						to: "/committee/support/$inquiryId",
						params: { inquiryId: inquiry.id },
					});
				}}
			/>
		</>
	);
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timerId = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(timerId);
	}, [value, delayMs]);
	return debounced;
}

type Inquiries = ListCommitteeInquiriesResponse["inquiries"];

// 全件を取得する列は、未返信の絞り込みを一覧の側で行う。ページ分けする「閲覧中」だけサーバーで絞る
function buildListQuery(
	view: CommitteeInquiryListView,
	paged: boolean,
	search: string,
	onlyUnreplied: boolean
) {
	return {
		view,
		search: search || undefined,
		awaitingReplyFrom:
			view === "VIEWING" && onlyUnreplied ? ("COMMITTEE" as const) : undefined,
		limit: paged ? PAGE_SIZE : undefined,
	};
}
type Cursors = Record<PagedView, string | null>;

type ListState = {
	/** 取得したときの条件（listKey） */
	key: string;
	tab: CommitteeTab;
	search: string;
	/** この一覧を取得した要求の番号。条件が変わったあとの「もっと見る」を区別する */
	requestId: number;
	/** 取得に失敗したときは null */
	lists: CommitteeInquiryLists | null;
	cursors: Cursors;
};

/**
 * 検索語のない条件で取得した一覧。詳細から戻ったときやタブを切り替えたときに先に表示し、裏で取り直す。
 * 別のユーザーの一覧を見せないよう、キーにユーザーの ID を含める。
 */
const listCache = new Map<string, ListState>();
/** 要求の番号。listCache の一覧の番号と重ならないよう、マウントし直しても数え直さない */
let lastRequestId = 0;

function listKey(
	userId: string,
	tab: CommitteeTab,
	search: string,
	onlyUnreplied: boolean
) {
	return JSON.stringify([userId, tab, search, onlyUnreplied]);
}

function pagedKey(view: PagedView) {
	return view === "VIEWING" ? "viewing" : "resolved";
}

/**
 * タブに必要な列を取得する。
 * バッジに件数を出す「自分の担当」と「下書き」はどのタブでも取得する。
 * 「閲覧中」と「解決済み」は PAGE_SIZE 件ずつ取得し、loadMore で続きを足す。
 * 「担当者未割り当て」は INQUIRY_ADMIN 以外には API が空で返す。
 */
function useCommitteeInquiryLists({
	userId,
	tab,
	search,
	onlyUnreplied,
}: {
	userId: string;
	tab: CommitteeTab;
	search: string;
	onlyUnreplied: boolean;
}) {
	const key = listKey(userId, tab, search, onlyUnreplied);
	const [state, setState] = useState<ListState | null>(
		() => listCache.get(key) ?? null
	);
	const [loadingMoreView, setLoadingMoreView] = useState<PagedView | null>(
		null
	);
	const requestIdRef = useRef(0);

	useEffect(() => {
		const requestId = ++lastRequestId;
		requestIdRef.current = requestId;
		const cached = listCache.get(key)?.lists;
		// 取り直すときは「もっと見る」で読み込んだ件数まで取る
		const limitFor = (view: PagedView) =>
			Math.max(PAGE_SIZE, cached?.[pagedKey(view)].items.length ?? 0);
		const fetchView = (view: CommitteeInquiryListView, limit?: number) =>
			listCommitteeInquiries({
				...buildListQuery(view, false, search, onlyUnreplied),
				limit,
			});
		const none = Promise.resolve({ inquiries: [], nextCursor: null });

		Promise.all([
			fetchView("MINE"),
			fetchView("DRAFT"),
			tab === "open" ? fetchView("UNASSIGNED") : none,
			tab === "open" ? fetchView("VIEWING", limitFor("VIEWING")) : none,
			tab === "resolved" ? fetchView("RESOLVED", limitFor("RESOLVED")) : none,
		])
			.then(([mine, draft, unassigned, viewing, resolved]) => {
				if (requestId !== requestIdRef.current) return;
				setState({
					key,
					tab,
					search,
					requestId,
					lists: {
						mine: mine.inquiries,
						draft: draft.inquiries,
						unassigned: unassigned.inquiries,
						viewing: {
							items: viewing.inquiries,
							hasMore: viewing.nextCursor !== null,
						},
						resolved: {
							items: resolved.inquiries,
							hasMore: resolved.nextCursor !== null,
						},
					},
					cursors: {
						VIEWING: viewing.nextCursor,
						RESOLVED: resolved.nextCursor,
					},
				});
			})
			.catch(error => {
				if (requestId !== requestIdRef.current) return;
				// 条件と合わない前の一覧を残さない
				setState({
					key,
					tab,
					search,
					requestId,
					lists: null,
					cursors: { VIEWING: null, RESOLVED: null },
				});
				reportHandledError({
					error,
					operation: "read",
					userMessage: "お問い合わせ一覧の取得に失敗しました",
					ui: { type: "toast" },
				});
			});
	}, [key, tab, search, onlyUnreplied]);

	useEffect(() => {
		if (state?.lists && state.search === "") {
			listCache.set(state.key, state);
		}
	}, [state]);

	async function loadMore(view: PagedView) {
		const cursor = state?.cursors[view];
		// 条件を変えたあとの取得が終わるまでは、前の条件の続きを読まない
		if (
			!state ||
			!cursor ||
			state.key !== key ||
			state.requestId !== requestIdRef.current
		)
			return;
		const { requestId } = state;
		setLoadingMoreView(view);
		try {
			const res = await listCommitteeInquiries({
				...buildListQuery(view, true, search, onlyUnreplied),
				cursor,
			});
			if (requestId !== requestIdRef.current) return;
			const listName = pagedKey(view);
			setState(prev => {
				if (!prev?.lists || prev.requestId !== requestId) return prev;
				const items: Inquiries = [
					...prev.lists[listName].items,
					...res.inquiries,
				];
				return {
					...prev,
					lists: {
						...prev.lists,
						[listName]: { items, hasMore: res.nextCursor !== null },
					},
					cursors: { ...prev.cursors, [view]: res.nextCursor },
				};
			});
		} catch (error) {
			if (requestId !== requestIdRef.current) return;
			reportHandledError({
				error,
				operation: "read",
				userMessage: "お問い合わせ一覧の取得に失敗しました",
				ui: { type: "toast" },
			});
		} finally {
			setLoadingMoreView(current => (current === view ? null : current));
		}
	}

	// 条件を変えた直後は、同じ条件で前に取得した一覧か、同じタブの前の一覧を表示したまま取り直す
	const current =
		state?.key === key
			? state
			: (listCache.get(key) ?? (state?.tab === tab ? state : null));
	// バッジの件数はタブによらないので、タブを切り替えた直後も前の値を出す
	const badgeLists = current?.lists ?? state?.lists;
	return {
		lists: current?.lists ?? null,
		badgeCounts: {
			mine: badgeLists?.mine.length ?? 0,
			draft: badgeLists?.draft.length ?? 0,
		},
		loadFailed: current !== null && current.lists === null,
		loadMore,
		loadingMoreView,
	};
}
