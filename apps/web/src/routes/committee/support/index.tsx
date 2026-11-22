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
		const { committeeMember, permissions } = useAuthStore.getState();

		const [projectsRes, membersRes, formsRes] = await Promise.all([
			listCommitteeProjects(),
			listCommitteeMembersPicker(),
			listMyForms(),
		]);

		// INQUIRY_ADMIN 権限チェック（store から参照）
		const isAdmin = permissions?.has("INQUIRY_ADMIN") ?? false;

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
			isAdmin,
		};
	},
});

function CommitteeSupportListPage() {
	const { tab } = Route.useSearch();
	const { projects, committeeMembers, availableForms, isAdmin } =
		Route.useLoaderData();
	const [formOpen, setFormOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [onlyUnreplied, setOnlyUnreplied] = useState(false);
	const search = useDebouncedValue(searchQuery.trim(), SEARCH_DEBOUNCE_MS);
	const { lists, loadFailed, loadMore, loadingMoreView } =
		useCommitteeInquiryLists({
			tab,
			search,
			onlyUnreplied,
			isAdmin,
		});
	const navigate = useNavigate();
	const router = useRouter();
	const { user } = useAuthStore();

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

/**
 * タブに必要な列を取得する。
 * バッジに件数を出す「自分の担当」と「下書き」はどのタブでも取得する。
 * 「閲覧中」と「解決済み」は PAGE_SIZE 件ずつ取得し、loadMore で続きを足す。
 */
function useCommitteeInquiryLists({
	tab,
	search,
	onlyUnreplied,
	isAdmin,
}: {
	tab: CommitteeTab;
	search: string;
	onlyUnreplied: boolean;
	isAdmin: boolean;
}) {
	const [state, setState] = useState<{
		tab: CommitteeTab;
		/** この一覧を取得した要求の番号。条件が変わったあとの「もっと見る」を区別する */
		requestId: number;
		lists: CommitteeInquiryLists | null;
		cursors: Cursors;
	} | null>(null);
	const [loadingMoreView, setLoadingMoreView] = useState<PagedView | null>(
		null
	);
	const requestIdRef = useRef(0);

	useEffect(() => {
		const requestId = ++requestIdRef.current;
		const fetchView = (
			view: CommitteeInquiryListView,
			options: { paged?: boolean } = {}
		) =>
			listCommitteeInquiries(
				buildListQuery(view, options.paged ?? false, search, onlyUnreplied)
			);
		const none = Promise.resolve({ inquiries: [], nextCursor: null });

		Promise.all([
			fetchView("MINE"),
			fetchView("DRAFT"),
			tab === "open" && isAdmin ? fetchView("UNASSIGNED") : none,
			tab === "open" ? fetchView("VIEWING", { paged: true }) : none,
			tab === "resolved" ? fetchView("RESOLVED", { paged: true }) : none,
		])
			.then(([mine, draft, unassigned, viewing, resolved]) => {
				if (requestId !== requestIdRef.current) return;
				setState({
					tab,
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
					tab,
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
	}, [tab, search, onlyUnreplied, isAdmin]);

	async function loadMore(view: PagedView) {
		const cursor = state?.cursors[view];
		// 条件を変えたあとの取得が終わるまでは、前の条件の続きを読まない
		if (!state || !cursor || state.requestId !== requestIdRef.current) return;
		const { requestId } = state;
		setLoadingMoreView(view);
		try {
			const res = await listCommitteeInquiries({
				...buildListQuery(view, true, search, onlyUnreplied),
				cursor,
			});
			if (requestId !== requestIdRef.current) return;
			const key = view === "VIEWING" ? "viewing" : "resolved";
			setState(prev => {
				if (!prev?.lists || prev.requestId !== requestId) return prev;
				// ページの間に更新されて上へ移った問い合わせが、続きにもう一度含まれることがある
				const loadedIds = new Set(prev.lists[key].items.map(inq => inq.id));
				const items: Inquiries = [
					...prev.lists[key].items,
					...res.inquiries.filter(inq => !loadedIds.has(inq.id)),
				];
				return {
					...prev,
					lists: {
						...prev.lists,
						[key]: { items, hasMore: res.nextCursor !== null },
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

	// タブを切り替えた直後は、前のタブの列を見せない
	const current = state && state.tab === tab ? state : null;
	return {
		lists: current?.lists ?? null,
		loadFailed: current !== null && current.lists === null,
		loadMore,
		loadingMoreView,
	};
}
