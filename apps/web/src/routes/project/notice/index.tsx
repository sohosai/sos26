import { Badge, Heading, Text } from "@radix-ui/themes";
import type { Bureau } from "@sos26/shared";
import { bureauLabelMap } from "@sos26/shared";
import { IconEye } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
import { DataTable, DateCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import { listProjectNotices } from "@/lib/api/project-notice";
import { useProjectStore } from "@/lib/project/store";
import { NoticeDetailDialog } from "./-components/NoticeDetailDialog";
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
	head: () => ({
		meta: [{ title: "お知らせ | 雙峰祭オンラインシステム" }],
	}),
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
	const [notices, setNotices] = useState<NoticeRow[]>(initialNotices);
	const { selectedProjectId } = useProjectStore();

	useEffect(() => {
		setNotices(initialNotices);
	}, [initialNotices]);

	const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);

	const handleRead = useCallback((noticeId: string) => {
		setNotices(prev =>
			prev.map(n => (n.id === noticeId ? { ...n, isRead: true } : n))
		);
	}, []);

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
					onClick={() => setSelectedNoticeId(row.original.id)}
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
				projectId={selectedProjectId ?? ""}
				onClose={() => setSelectedNoticeId(null)}
				onRead={handleRead}
			/>
		</div>
	);
}
