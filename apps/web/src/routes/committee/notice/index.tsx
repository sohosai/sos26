import { AlertDialog, Heading, Text } from "@radix-ui/themes";
import type { GetNoticeResponse } from "@sos26/shared";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
import {
	AvatarGroupCell,
	type AvatarGroupItem,
	DataTable,
	DateCell,
	NameCell,
} from "@/components/patterns";
import { Button } from "@/components/primitives";
import { deleteNotice, listNotices } from "@/lib/api/committee-notice";
import { useAuthStore } from "@/lib/auth";
import { CreateNoticeDialog } from "./CreateNoticeDialog";
import styles from "./index.module.scss";
import { NoticeDetailDialog } from "./NoticeDetailDialog";

type NoticeRow = {
	id: string;
	ownerId: string;
	title: string;
	ownerName: string;
	collaborators: AvatarGroupItem[];
	createdAt: Date;
	updatedAt: Date;
	approverName: string;
};

type NoticeDetail = GetNoticeResponse["notice"];

const noticeColumnHelper = createColumnHelper<NoticeRow>();

export const Route = createFileRoute("/committee/notice/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { user } = useAuthStore();
	const [notices, setNotices] = useState<NoticeRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// 作成 / 編集ダイアログ
	const [noticeDialog, setNoticeDialog] = useState<{
		open: boolean;
		noticeId?: string;
		initialValues?: { title: string; body: string };
	}>({ open: false });

	// 詳細ダイアログ
	const [detailNoticeId, setDetailNoticeId] = useState<string | null>(null);

	// 削除確認ダイアログ
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

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
					createdAt: n.createdAt,
					updatedAt: n.updatedAt,
					approverName: n.authorization?.requestedTo.name ?? "",
				}))
			);
		} catch (error) {
			console.error(error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchNotices();
	}, [fetchNotices]);

	const handleEditFromDetail = (notice: NoticeDetail) => {
		setDetailNoticeId(null);
		setNoticeDialog({
			open: true,
			noticeId: notice.id,
			initialValues: { title: notice.title, body: notice.body ?? "" },
		});
	};

	const handleDeleteFromDetail = (noticeId: string) => {
		setDetailNoticeId(null);
		setDeleteConfirmId(noticeId);
	};

	const handleDelete = async () => {
		if (!deleteConfirmId) return;
		setIsDeleting(true);
		try {
			await deleteNotice(deleteConfirmId);
			setDeleteConfirmId(null);
			await fetchNotices();
		} catch (error) {
			console.error(error);
		} finally {
			setIsDeleting(false);
		}
	};

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
				<Button
					intent="ghost"
					size="1"
					onClick={() => setDetailNoticeId(row.original.id)}
				>
					<IconEye size={16} />
					詳細
				</Button>
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
						onClick={() => setNoticeDialog({ open: true })}
					>
						<IconPlus size={16} stroke={1.5} />
						お知らせを作成
					</Button>
				}
			/>

			{/* 作成 / 編集ダイアログ */}
			<CreateNoticeDialog
				open={noticeDialog.open}
				onOpenChange={open => setNoticeDialog(prev => ({ ...prev, open }))}
				noticeId={noticeDialog.noticeId}
				initialValues={noticeDialog.initialValues}
				onSuccess={fetchNotices}
			/>

			{/* 詳細ダイアログ */}
			<NoticeDetailDialog
				noticeId={detailNoticeId}
				currentUserId={user?.id ?? ""}
				onClose={() => setDetailNoticeId(null)}
				onEdit={handleEditFromDetail}
				onDelete={handleDeleteFromDetail}
			/>

			{/* 削除確認ダイアログ */}
			<AlertDialog.Root
				open={deleteConfirmId !== null}
				onOpenChange={open => {
					if (!open) setDeleteConfirmId(null);
				}}
			>
				<AlertDialog.Content maxWidth="400px">
					<AlertDialog.Title>お知らせを削除</AlertDialog.Title>
					<AlertDialog.Description size="2">
						このお知らせを削除しますか？この操作は取り消せません。
					</AlertDialog.Description>
					<div className={styles.deleteActions}>
						<AlertDialog.Cancel>
							<Button intent="secondary" size="2">
								キャンセル
							</Button>
						</AlertDialog.Cancel>
						<Button
							intent="danger"
							size="2"
							onClick={handleDelete}
							loading={isDeleting}
						>
							削除する
						</Button>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</div>
	);
}
