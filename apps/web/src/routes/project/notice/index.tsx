import { Dialog, Heading, Text } from "@radix-ui/themes";
import { IconEye } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { DataTable, DateCell, TagCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import styles from "./index.module.scss";

export type NoticeRow = {
	id: string;
	title: string;
	department: string;
	publishedAt: Date;
	statusLabel: string[];
	content: string;
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
		content:
			"企画書の提出期限は2026年3月1日（日）23:59です。期限を過ぎた場合、企画の実施が認められない場合がありますのでご注意ください。提出はオンラインシステムから行ってください。",
	},
	{
		id: "2",
		title: "ステージ使用に関する注意事項",
		department: "ステージ管理局",
		publishedAt: new Date("2026-02-10T14:30:00"),
		statusLabel: ["チェック済み"],
		content:
			"ステージ使用にあたり、以下の点にご注意ください。音量制限は85dB以下とします。リハーサル時間は本番前日の指定時間帯のみとなります。機材の持ち込みについては事前申請が必要です。",
	},
	{
		id: "3",
		title: "電力申請の締切について",
		department: "施設局",
		publishedAt: new Date("2026-02-08T09:00:00"),
		statusLabel: ["未チェック"],
		content:
			"電力使用申請の締切は2026年2月28日（土）です。申請がない場合、当日の電力供給ができません。必要な電力量を正確に記入してください。",
	},
	{
		id: "4",
		title: "参加者向け説明会の開催",
		department: "総務局",
		publishedAt: new Date("2026-02-05T16:00:00"),
		statusLabel: ["チェック済み"],
		content:
			"参加団体向けの説明会を2026年2月20日（金）18:00より開催します。場所は1B棟201教室です。各団体から最低1名の参加をお願いします。",
	},
	{
		id: "5",
		title: "物品貸出申請の開始について",
		department: "施設局",
		publishedAt: new Date("2026-02-01T11:00:00"),
		statusLabel: ["チェック済み"],
		content:
			"物品貸出申請の受付を開始しました。テント、テーブル、椅子等の貸出を希望する団体は、オンラインシステムから申請してください。数に限りがありますので、早めの申請をお勧めします。",
	},
];

export const Route = createFileRoute("/project/notice/")({
	component: RouteComponent,
});

function RouteComponent() {
	const [selectedNotice, setSelectedNotice] = useState<NoticeRow | null>(null);

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
			cell: ({ row }) => (
				<Button
					intent="secondary"
					size="1"
					onClick={() => setSelectedNotice(row.original)}
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

			<Dialog.Root
				open={selectedNotice !== null}
				onOpenChange={open => {
					if (!open) setSelectedNotice(null);
				}}
			>
				<Dialog.Content className={styles.dialogContent}>
					<Dialog.Title>{selectedNotice?.title}</Dialog.Title>
					<Dialog.Description size="2" color="gray">
						{selectedNotice?.publishedAt.toLocaleDateString("ja-JP", {
							year: "numeric",
							month: "2-digit",
							day: "2-digit",
						})}{" "}
						{selectedNotice?.department}
					</Dialog.Description>
					<Text as="p" size="2" className={styles.noticeContent}>
						{selectedNotice?.content}
					</Text>
					<div className={styles.dialogActions}>
						<Dialog.Close>
							<Button intent="secondary">閉じる</Button>
						</Dialog.Close>
					</div>
				</Dialog.Content>
			</Dialog.Root>
		</div>
	);
}
