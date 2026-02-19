import { Badge, Dialog, Heading, Text } from "@radix-ui/themes";
import type { Bureau } from "@sos26/shared";
import { bureauLabelMap } from "@sos26/shared";
import { IconEye } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable, DateCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import {
	getProjectNotice,
	listProjectNotices,
	readProjectNotice,
} from "@/lib/api/project-notice";
import { formatDate } from "@/lib/format";
import { useProject } from "@/lib/project/context";
import { sanitizeHtml } from "@/lib/sanitize";
import styles from "./index.module.scss";

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

const noticeColumnHelper = createColumnHelper<NoticeRow>();

export const Route = createFileRoute("/project/notice/")({
	component: RouteComponent,
});

function RouteComponent() {
	const project = useProject();
	const [notices, setNotices] = useState<NoticeRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
	const [selectedNoticeBody, setSelectedNoticeBody] = useState<string | null>(
		null
	);
	const [selectedNoticeTitle, setSelectedNoticeTitle] = useState("");
	const [selectedNoticeMeta, setSelectedNoticeMeta] = useState("");
	const [isLoadingDetail, setIsLoadingDetail] = useState(false);

	const fetchNotices = useCallback(async () => {
		setIsLoading(true);
		try {
			const res = await listProjectNotices(project.id);
			setNotices(
				res.notices.map(n => ({
					id: n.id,
					title: n.title,
					ownerName: n.owner.name,
					ownerBureau: n.ownerBureau,
					deliveredAt: n.deliveredAt,
					isRead: n.isRead,
				}))
			);
		} catch {
			toast.error("お知らせ一覧の取得に失敗しました");
		} finally {
			setIsLoading(false);
		}
	}, [project.id]);

	useEffect(() => {
		fetchNotices();
	}, [fetchNotices]);

	const handleOpenNotice = async (noticeId: string) => {
		setSelectedNoticeId(noticeId);
		setIsLoadingDetail(true);
		try {
			const res = await getProjectNotice(project.id, noticeId);
			setSelectedNoticeTitle(res.notice.title);
			setSelectedNoticeBody(res.notice.body);
			setSelectedNoticeMeta(
				`${formatDate(new Date(res.notice.deliveredAt), "datetime")}　${getBureauLabel(res.notice.ownerBureau)}`
			);

			if (!res.notice.isRead) {
				await readProjectNotice(project.id, noticeId);
				setNotices(prev =>
					prev.map(n => (n.id === noticeId ? { ...n, isRead: true } : n))
				);
			}
		} catch {
			toast.error("お知らせの取得に失敗しました");
		} finally {
			setIsLoadingDetail(false);
		}
	};

	const handleCloseDialog = (open: boolean) => {
		if (!open) {
			setSelectedNoticeId(null);
			setSelectedNoticeBody(null);
			setSelectedNoticeTitle("");
			setSelectedNoticeMeta("");
		}
	};

	const sanitizedBody = useMemo(
		() => (selectedNoticeBody ? sanitizeHtml(selectedNoticeBody) : null),
		[selectedNoticeBody]
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
					onClick={() => handleOpenNotice(row.original.id)}
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
				data={isLoading ? [] : notices}
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

			<Dialog.Root
				open={selectedNoticeId !== null}
				onOpenChange={handleCloseDialog}
			>
				<Dialog.Content className={styles.dialogContent}>
					{isLoadingDetail ? (
						<Text size="2" color="gray">
							読み込み中...
						</Text>
					) : (
						<>
							<Dialog.Title>{selectedNoticeTitle}</Dialog.Title>
							<Dialog.Description size="2" color="gray">
								{selectedNoticeMeta}
							</Dialog.Description>
							<hr className={styles.dialogDivider} />
							{sanitizedBody ? (
								<div
									className={styles.noticeContent}
									// biome-ignore lint/security/noDangerouslySetInnerHtml: サニタイズ済みHTML
									dangerouslySetInnerHTML={{ __html: sanitizedBody }}
								/>
							) : (
								<Text as="p" size="2" color="gray" mt="4">
									本文なし
								</Text>
							)}
							<div className={styles.dialogActions}>
								<Dialog.Close>
									<Button intent="secondary">閉じる</Button>
								</Dialog.Close>
							</div>
						</>
					)}
				</Dialog.Content>
			</Dialog.Root>
		</div>
	);
}
