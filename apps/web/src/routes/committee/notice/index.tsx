import { Badge, Heading, Text } from "@radix-ui/themes";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	AvatarGroupCell,
	type AvatarGroupItem,
	DataTable,
	DateCell,
	NameCell,
} from "@/components/patterns";
import { Button } from "@/components/primitives";
import { listNotices } from "@/lib/api/committee-notice";
import {
	getNoticeStatusFromAuth,
	type NoticeStatusInfo,
} from "@/lib/notice-status";
import { CreateNoticeDialog } from "./-components/CreateNoticeDialog";
import styles from "./index.module.scss";

type NoticeRow = {
	id: string;
	ownerId: string;
	title: string;
	ownerName: string;
	collaborators: AvatarGroupItem[];
	updatedAt: Date;
	approverName: string;
	status: NoticeStatusInfo;
};

const noticeColumnHelper = createColumnHelper<NoticeRow>();

export const Route = createFileRoute("/committee/notice/")({
	component: RouteComponent,
});

function RouteComponent() {
	const [notices, setNotices] = useState<NoticeRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// 作成ダイアログ
	const [createDialogOpen, setCreateDialogOpen] = useState(false);

	const fetchNotices = useCallback(async () => {
		setIsLoading(true);
		try {
			const res = await listNotices();
			setNotices(
				res.notices.map(n => ({
					id: n.id,
					ownerId: n.ownerId,
					title: n.title,
					ownerName: n.owner.name,
					collaborators: n.collaborators,
					updatedAt: n.updatedAt,
					approverName: n.authorization?.requestedTo.name ?? "",
					status: getNoticeStatusFromAuth(n.authorization),
				}))
			);
		} catch {
			toast.error("お知らせ一覧の取得に失敗しました");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchNotices();
	}, [fetchNotices]);

	const columns = [
		noticeColumnHelper.accessor("title", {
			header: "タイトル",
		}),
		noticeColumnHelper.accessor("ownerName", {
			header: "オーナー",
			cell: NameCell,
		}),
		noticeColumnHelper.accessor("collaborators", {
			header: "共同編集者",
			cell: AvatarGroupCell,
		}),
		noticeColumnHelper.accessor("updatedAt", {
			header: "更新日",
			cell: DateCell,
			meta: { dateFormat: "date" },
		}),
		noticeColumnHelper.accessor("status", {
			header: "ステータス",
			cell: ctx => {
				const { label, color } = ctx.getValue();
				return (
					<Badge variant="soft" color={color}>
						{label}
					</Badge>
				);
			},
		}),
		noticeColumnHelper.accessor("approverName", {
			header: "承認者",
			cell: ctx => {
				const name = ctx.getValue();
				if (!name)
					return (
						<Text size="2" color="gray">
							—
						</Text>
					);
				return <NameCell {...ctx} />;
			},
		}),
		noticeColumnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<Link
					to="/committee/notice/$noticeId"
					params={{ noticeId: row.original.id }}
				>
					<Button intent="ghost" size="1">
						<IconEye size={16} />
						詳細
					</Button>
				</Link>
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
				initialSorting={[{ id: "updatedAt", desc: true }]}
				toolbarExtra={
					<Button
						intent="primary"
						size="2"
						onClick={() => setCreateDialogOpen(true)}
					>
						<IconPlus size={16} stroke={1.5} />
						お知らせを作成
					</Button>
				}
			/>

			<CreateNoticeDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onSuccess={fetchNotices}
			/>
		</div>
	);
}
