import { Badge, Heading, Text } from "@radix-ui/themes";
import type {
	Bureau,
	GetProjectNoticeResponse,
	ListProjectNoticesResponse,
} from "@sos26/shared";
import { bureauLabelMap, ErrorCode } from "@sos26/shared";
import { IconEye } from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DataTable, DateCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import { getProjectNotice } from "@/lib/api/project-notice";
import { isClientError } from "@/lib/http/error";
import { refreshNotificationDot } from "@/lib/project/notification-status";
import { useProjectStore } from "@/lib/project/store";
import { syncSelectedProjectFromSearch } from "@/lib/project/sync";
import { queryClient } from "@/lib/query/client";
import { projectNoticesQuery } from "@/lib/query/project";
import { NoticeDetailDialog } from "./-components/NoticeDetailDialog";
import styles from "./index.module.scss";

const searchSchema = z.object({
	projectId: z.string().optional(),
	noticeId: z.string().optional(),
});

const getBureauLabel = (bureau: string): string =>
	bureauLabelMap[bureau as Bureau] ?? bureau;

type NoticeRow = {
	id: string;
	title: string;
	ownerName: string;
	ownerBureau: string;
	deliveredAt: Date;
	isRead: boolean;
};
type ProjectNoticeListItem = ListProjectNoticesResponse["notices"][number];

function toNoticeRow(n: ProjectNoticeListItem): NoticeRow {
	return {
		id: n.id,
		title: n.title,
		ownerName: n.owner.name,
		ownerBureau: n.ownerBureau,
		deliveredAt: n.deliveredAt,
		isRead: n.isRead,
	};
}

type NoticeDetail = GetProjectNoticeResponse["notice"];
type ResolvedNotice = { projectId: string; notice: NoticeDetail };
type SelectedNotice = {
	id: string;
	projectId: string;
	initialNotice: NoticeDetail | null;
	source: "list" | "search";
};

const noticeColumnHelper = createColumnHelper<NoticeRow>();
const resolvedNoticeCache = new Map<string, ResolvedNotice>();

function getResolvedNoticeCacheKey(
	projectId: string,
	noticeId: string
): string {
	return `${projectId}:${noticeId}`;
}

function markCachedNoticeRead(noticeId: string) {
	for (const [key, resolved] of resolvedNoticeCache) {
		if (resolved.notice.id !== noticeId || resolved.notice.isRead) continue;
		resolvedNoticeCache.set(key, {
			...resolved,
			notice: { ...resolved.notice, isRead: true },
		});
	}
}

function isNoticeUnavailableError(error: unknown): boolean {
	return (
		isClientError(error) &&
		(error.code === ErrorCode.NOT_FOUND || error.code === ErrorCode.FORBIDDEN)
	);
}

async function getNoticeDetailInProject(
	projectId: string,
	noticeId: string,
	signal: AbortSignal
): Promise<ResolvedNotice | null> {
	if (signal.aborted) return null;
	const cached = resolvedNoticeCache.get(
		getResolvedNoticeCacheKey(projectId, noticeId)
	);
	if (cached) return cached;

	try {
		const { notice } = await getProjectNotice(projectId, noticeId);
		const resolved = { projectId, notice };
		resolvedNoticeCache.set(
			getResolvedNoticeCacheKey(projectId, noticeId),
			resolved
		);
		return resolved;
	} catch (error) {
		if (!isNoticeUnavailableError(error)) {
			throw error;
		}
		return null;
	}
}

async function resolveNoticeProject(
	noticeId: string,
	preferredProjectId: string,
	isInPreferredProject: boolean,
	signal: AbortSignal
): Promise<ResolvedNotice | null> {
	if (isInPreferredProject) {
		return getNoticeDetailInProject(preferredProjectId, noticeId, signal);
	}

	const { projects } = useProjectStore.getState();
	for (const project of projects) {
		if (project.id === preferredProjectId) continue;
		if (signal.aborted) return null;
		// 配信直後のお知らせを見落とさないよう、キャッシュがあっても取り直す
		const { notices } = await queryClient.fetchQuery({
			...projectNoticesQuery(project.id),
			staleTime: 0,
		});
		if (!notices.some(n => n.id === noticeId)) continue;
		return getNoticeDetailInProject(project.id, noticeId, signal);
	}
	return null;
}

export const Route = createFileRoute("/project/notice/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "お知らせ | 雙峰祭オンラインシステム" }],
	}),
	validateSearch: searchSchema,
	beforeLoad: ({ search }) => {
		syncSelectedProjectFromSearch(search.projectId);
	},
	loader: async ({ context }) => {
		// 新着があれば一覧が古くなっているので、確認を待ってから読む
		await context.notificationStatusCheck;
		const { selectedProjectId } = useProjectStore.getState();
		if (selectedProjectId) {
			await queryClient.fetchQuery(projectNoticesQuery(selectedProjectId));
		}
		return { projectId: selectedProjectId };
	},
});

function RouteComponent() {
	const { projectId } = Route.useLoaderData();
	return projectId ? <ProjectNoticePage projectId={projectId} /> : null;
}

/**
 * 一覧は loader が取得した企画のものを使う。企画を切り替えたときに、新しい loader が終わるまで前の企画の一覧を出したままにするため
 */
function ProjectNoticePage({ projectId }: { projectId: string }) {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const { data } = useSuspenseQuery(projectNoticesQuery(projectId));
	const notices = useMemo(() => data.notices.map(toNoticeRow), [data]);
	const isTargetInSelectedProject =
		search.noticeId !== undefined &&
		data.notices.some(n => n.id === search.noticeId);

	const [selectedNotice, setSelectedNotice] = useState<SelectedNotice | null>(
		null
	);

	// /committee/notice/{noticeId}/ から振り替えられた場合、所属企画を順に探して
	// 該当のお知らせを自動でダイアログ表示する。
	useEffect(() => {
		const targetNoticeId = search.noticeId;
		if (!targetNoticeId) {
			// 一覧から開いたお知らせは、新着の反映などで loader が再実行されても閉じない。
			// URL経由で開いた場合のみ、noticeIdがなくなったら選択を解除する。
			setSelectedNotice(current =>
				current?.source === "search" ? null : current
			);
			return;
		}

		const controller = new AbortController();
		void resolveNoticeProject(
			targetNoticeId,
			projectId,
			isTargetInSelectedProject,
			controller.signal
		)
			.then(result => {
				if (controller.signal.aborted) return;
				if (result) {
					if (projectId !== result.projectId) {
						useProjectStore.getState().setSelectedProjectId(result.projectId);
						navigate({
							to: "/project/notice",
							search: { noticeId: targetNoticeId },
							replace: true,
						});
						return;
					}

					setSelectedNotice({
						id: targetNoticeId,
						projectId: result.projectId,
						initialNotice: result.notice,
						source: "search",
					});
				} else {
					toast.error("このお知らせを表示する権限がありません");
					navigate({ to: "/project/notice", search: {}, replace: true });
				}
			})
			.catch(() => {
				if (controller.signal.aborted) return;
				toast.error("お知らせの取得に失敗しました");
				navigate({ to: "/project/notice", search: {}, replace: true });
			});

		return () => controller.abort();
	}, [search.noticeId, projectId, navigate, isTargetInSelectedProject]);

	const handleRead = useCallback(
		(noticeId: string) => {
			queryClient.setQueryData(
				projectNoticesQuery(projectId).queryKey,
				prev =>
					prev && {
						...prev,
						notices: prev.notices.map(n =>
							n.id === noticeId ? { ...n, isRead: true } : n
						),
					}
			);
			markCachedNoticeRead(noticeId);
			void refreshNotificationDot();
		},
		[projectId]
	);

	const columns = [
		noticeColumnHelper.accessor("title", {
			header: "タイトル",
		}),
		noticeColumnHelper.accessor("ownerBureau", {
			header: "担当部署",
			cell: ctx => getBureauLabel(ctx.getValue()),
		}),
		noticeColumnHelper.accessor("deliveredAt", {
			header: "配信日時",
			cell: DateCell,
			meta: { dateFormat: "datetime" },
		}),
		noticeColumnHelper.accessor("isRead", {
			header: "ステータス",
			cell: ctx => {
				const isRead = ctx.getValue();
				return isRead ? (
					<Badge variant="soft" color="blue">
						チェック済み
					</Badge>
				) : (
					<Badge variant="soft" color="gray">
						未チェック
					</Badge>
				);
			},
		}),
		noticeColumnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<Button
					intent="secondary"
					size="1"
					onClick={() => {
						setSelectedNotice({
							id: row.original.id,
							projectId,
							initialNotice: null,
							source: "list",
						});
					}}
				>
					<IconEye size={16} />
					お知らせを見る
				</Button>
			),
			enableSorting: false,
		}),
	];

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<Heading size="6">お知らせ</Heading>
				<Text size="2" color="gray">
					実委人から配信されたお知らせを確認できます。
				</Text>
			</div>

			<DataTable<NoticeRow>
				data={notices}
				columns={columns}
				features={{
					sorting: true,
					globalFilter: true,
					columnVisibility: false,
					selection: false,
					copy: false,
					csvExport: false,
				}}
				initialSorting={[
					{
						id: "deliveredAt",
						desc: true,
					},
				]}
			/>

			<NoticeDetailDialog
				noticeId={selectedNotice?.id ?? null}
				projectId={selectedNotice?.projectId ?? null}
				onClose={() => {
					setSelectedNotice(null);
					if (search.noticeId) {
						navigate({
							to: "/project/notice",
							search: { projectId: search.projectId },
							replace: true,
						});
					}
				}}
				initialNotice={selectedNotice?.initialNotice ?? null}
				onRead={handleRead}
			/>
		</div>
	);
}
