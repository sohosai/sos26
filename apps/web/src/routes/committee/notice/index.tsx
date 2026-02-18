import { Flex, Heading, Popover, Text } from "@radix-ui/themes";
import { IconDotsVertical, IconEdit, IconTrash } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import {
	AvatarGroupCell,
	type AvatarGroupItem,
	DataTable,
	DateCell,
	NameCell,
} from "@/components/patterns";
import { Button, IconButton } from "@/components/primitives";
import styles from "./index.module.scss";

type NoticeRow = {
	id: string;
	title: string;
	owner: string;
	sharedUsers: AvatarGroupItem[];
	createdAt: Date;
	updatedAt: Date;
	approver: string;
};

const noticeColumnHelper = createColumnHelper<NoticeRow>();

// モックデータ（API接続時に置き換え）
const mockNotices: NoticeRow[] = [
	{
		id: "1",
		title: "企画書提出期限のお知らせ",
		owner: "田中太郎",
		sharedUsers: [{ name: "佐藤花子" }, { name: "鈴木一郎" }],
		createdAt: new Date("2026-02-15"),
		updatedAt: new Date("2026-02-16"),
		approver: "山田次郎",
	},
	{
		id: "2",
		title: "ステージ使用に関する注意事項",
		owner: "佐藤花子",
		sharedUsers: [
			{ name: "田中太郎" },
			{ name: "鈴木一郎" },
			{ name: "山田次郎" },
		],
		createdAt: new Date("2026-02-10"),
		updatedAt: new Date("2026-02-12"),
		approver: "高橋三郎",
	},
	{
		id: "3",
		title: "電力申請の締切について",
		owner: "鈴木一郎",
		sharedUsers: [],
		createdAt: new Date("2026-02-08"),
		updatedAt: new Date("2026-02-08"),
		approver: "田中太郎",
	},
	{
		id: "4",
		title: "参加者向け説明会の開催",
		owner: "高橋三郎",
		sharedUsers: [
			{ name: "田中太郎" },
			{ name: "佐藤花子" },
			{ name: "鈴木一郎" },
			{ name: "山田次郎" },
			{ name: "中村四郎" },
		],
		createdAt: new Date("2026-02-05"),
		updatedAt: new Date("2026-02-06"),
		approver: "佐藤花子",
	},
	{
		id: "5",
		title: "物品貸出申請の開始について",
		owner: "山田次郎",
		sharedUsers: [{ name: "高橋三郎" }],
		createdAt: new Date("2026-02-01"),
		updatedAt: new Date("2026-02-03"),
		approver: "鈴木一郎",
	},
];

export const Route = createFileRoute("/committee/notice/")({
	component: RouteComponent,
});

function RouteComponent() {
	const columns = [
		noticeColumnHelper.accessor("title", {
			header: "タイトル",
		}),
		noticeColumnHelper.accessor("owner", {
			header: "オーナー",
			cell: NameCell,
		}),
		noticeColumnHelper.accessor("sharedUsers", {
			header: "共有者",
			cell: AvatarGroupCell,
		}),
		noticeColumnHelper.accessor("createdAt", {
			header: "投稿日",
			cell: DateCell,
			meta: { dateFormat: "date" },
		}),
		noticeColumnHelper.accessor("updatedAt", {
			header: "更新日",
			cell: DateCell,
			meta: { dateFormat: "date" },
		}),
		noticeColumnHelper.accessor("approver", {
			header: "承認者",
			cell: NameCell,
		}),
		noticeColumnHelper.display({
			id: "actions",
			header: "操作",
			cell: () => (
				<Popover.Root>
					<Popover.Trigger>
						<IconButton aria-label="操作メニュー">
							<IconDotsVertical size={16} />
						</IconButton>
					</Popover.Trigger>
					<Popover.Content align="start" sideOffset={4}>
						<Flex direction="column" gap="1" align="start">
							<Button intent="ghost" size="2">
								<IconEdit size={16} />
								編集
							</Button>
							<Button intent="ghost" size="2">
								<IconTrash size={16} />
								削除
							</Button>
						</Flex>
					</Popover.Content>
				</Popover.Root>
			),
			enableSorting: false,
		}),
	];

	return (
		<div>
			<div className={styles.header}>
				<Heading size="6">お知らせ</Heading>
				<Text size="2" color="gray">
					お知らせの管理・配信ができます。
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
						id: "createdAt",
						desc: true,
					},
				]}
			/>
		</div>
	);
}
