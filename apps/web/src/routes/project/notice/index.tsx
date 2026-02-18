import { Heading, Text } from "@radix-ui/themes";
import { IconEye } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable, DateCell, TagCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import styles from "./index.module.scss";

export type NoticeRow = {
	id: string;
	title: string;
	department: string;
	publishedAt: Date;
	statusLabel: string[];
};

const statusColorMap: Record<string, string> = {
	未チェック: "gray",
	チェック済み: "blue",
};

const noticeColumnHelper = createColumnHelper<NoticeRow>();

// モックデータ（API接続時に置き換え）
const mockNotices: NoticeRow[] = [
	{
		id: "1",
		title: "企画書提出期限のお知らせ",
		department: "企画局",
		publishedAt: new Date("2026-02-15T10:00:00"),
		statusLabel: ["未チェック"],
	},
	{
		id: "2",
		title: "ステージ使用に関する注意事項",
		department: "ステージ管理局",
		publishedAt: new Date("2026-02-10T14:30:00"),
		statusLabel: ["チェック済み"],
	},
	{
		id: "3",
		title: "電力申請の締切について",
		department: "施設局",
		publishedAt: new Date("2026-02-08T09:00:00"),
		statusLabel: ["未チェック"],
	},
	{
		id: "4",
		title: "参加者向け説明会の開催",
		department: "総務局",
		publishedAt: new Date("2026-02-05T16:00:00"),
		statusLabel: ["チェック済み"],
	},
	{
		id: "5",
		title: "物品貸出申請の開始について",
		department: "施設局",
		publishedAt: new Date("2026-02-01T11:00:00"),
		statusLabel: ["チェック済み"],
	},
];

export const Route = createFileRoute("/project/notice/")({
	component: RouteComponent,
});

function RouteComponent() {
	const columns = [
		noticeColumnHelper.accessor("title", {
			header: "タイトル",
		}),
		noticeColumnHelper.accessor("department", {
			header: "担当部署",
		}),
		noticeColumnHelper.accessor("publishedAt", {
			header: "配信日時",
			cell: DateCell,
			meta: { dateFormat: "datetime" },
		}),
		noticeColumnHelper.accessor("statusLabel", {
			header: "ステータス",
			cell: TagCell,
			meta: {
				tagColors: statusColorMap,
			},
		}),
		noticeColumnHelper.display({
			id: "actions",
			header: "操作",
			cell: () => (
				<Button intent="secondary" size="1">
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
				data={mockNotices}
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
						id: "publishedAt",
						desc: true,
					},
				]}
			/>
		</div>
	);
}
