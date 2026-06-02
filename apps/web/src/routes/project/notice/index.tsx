import { Badge, Heading, Text } from "@radix-ui/themes";
import type { Bureau, GetProjectNoticeResponse } from "@sos26/shared";
import { bureauLabelMap, ErrorCode } from "@sos26/shared";
import { IconEye } from "@tabler/icons-react";
import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DataTable, DateCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import { getProjectNotice, listProjectNotices } from "@/lib/api/project-notice";
import { isClientError } from "@/lib/http/error";
import { useProjectStore } from "@/lib/project/store";
import { syncSelectedProjectFromSearch } from "@/lib/project/sync";
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
type NoticeDetail = GetProjectNoticeResponse["notice"];
type ResolvedNotice = { projectId: string; notice: NoticeDetail };

const noticeColumnHelper = createColumnHelper<NoticeRow>();
const resolvedNoticeCache = new Map<string, ResolvedNotice>();

function getResolvedNoticeCacheKey(
	projectId: string,
	noticeId: string
): string {
	return `${projectId}:${noticeId}`;
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
	preferredProjectId: string | undefined,
	preferredNotices: NoticeRow[],
	signal: AbortSignal
): Promise<ResolvedNotice | null> {
	if (preferredProjectId && preferredNotices.some(n => n.id === noticeId)) {
		return getNoticeDetailInProject(preferredProjectId, noticeId, signal);
	}

	const { projects } = useProjectStore.getState();
	for (const project of projects) {
		if (project.id === preferredProjectId) continue;
		if (signal.aborted) return null;
		const { notices } = await listProjectNotices(project.id);
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
	loader: async () => {
		const { selectedProjectId } = useProjectStore.getState();
		if (!selectedProjectId) return { notices: [] as NoticeRow[] };
		const res = await listProjectNotices(selectedProjectId);
		return {
			notices: res.notices.map(n => ({
				id: n.id,
				title: n.title,
				ownerName: n.owner.name,
				ownerBureau: n.ownerBureau,
				deliveredAt: n.deliveredAt,
				isRead: n.isRead,
			})),
		};
	},
});

function RouteComponent() {
	const { notices: initialNotices } = Route.useLoaderData();
	const search = Route.useSearch();
	const router = useRouter();
	const navigate = useNavigate();
	const [notices, setNotices] = useState<NoticeRow[]>(initialNotices);
	const { selectedProjectId } = useProjectStore();

	useEffect(() => {
		setNotices(initialNotices);
	}, [initialNotices]);

	const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
	const [selectedNoticeProjectId, setSelectedNoticeProjectId] = useState<
		string | null
	>(null);
	const [preloadedNotice, setPreloadedNotice] = useState<NoticeDetail | null>(
		null
	);

	// /committee/notice/{noticeId}/ から振り替えられた場合、所属企画を順に探して
	// 該当のお知らせを自動でダイアログ表示する。
	useEffect(() => {
		const targetNoticeId = search.noticeId;
		if (!targetNoticeId) {
			setSelectedNoticeId(null);
			setSelectedNoticeProjectId(null);
			setPreloadedNotice(null);
			return;
		}

		const controller = new AbortController();
		const preferredProjectId = selectedProjectId ?? undefined;
		void resolveNoticeProject(
			targetNoticeId,
			preferredProjectId,
			initialNotices,
			controller.signal
		)
			.then(result => {
				if (controller.signal.aborted) return;
				if (result) {
					if (selectedProjectId !== result.projectId) {
						useProjectStore.getState().setSelectedProjectId(result.projectId);
						navigate({
							to: "/project/notice",
							search: { noticeId: targetNoticeId },
							replace: true,
						});
						return;
					}

					setSelectedNoticeProjectId(result.projectId);
					setSelectedNoticeId(targetNoticeId);
					setPreloadedNotice(result.notice);
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
	}, [search.noticeId, selectedProjectId, navigate, initialNotices]);

	const handleRead = useCallback(
		(noticeId: string) => {
			setNotices(prev =>
				prev.map(n => (n.id === noticeId ? { ...n, isRead: true } : n))
			);
			void router.invalidate();
		},
		[router]
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
						setSelectedNoticeProjectId(selectedProjectId);
						setSelectedNoticeId(row.original.id);
						setPreloadedNotice(null);
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
				noticeId={selectedNoticeId}
				projectId={selectedNoticeProjectId ?? ""}
				onClose={() => {
					setSelectedNoticeId(null);
					setSelectedNoticeProjectId(null);
					setPreloadedNotice(null);
					if (search.noticeId) {
						navigate({
							to: "/project/notice",
							search: { projectId: search.projectId },
							replace: true,
						});
					}
				}}
				initialNotice={preloadedNotice}
				onRead={handleRead}
			/>
		</div>
	);
}
