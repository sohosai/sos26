import { Badge, Dialog, Heading, Popover, Text } from "@radix-ui/themes";
import type {
	GetNoticeResponse,
	NoticeAuthorizationStatus,
} from "@sos26/shared";
import {
	IconDotsVertical,
	IconEdit,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
import {
	AvatarGroupCell,
	type AvatarGroupItem,
	DataTable,
	DateCell,
	NameCell,
	RichTextContent,
	TagCell,
} from "@/components/patterns";
import { Button, IconButton } from "@/components/primitives";
import {
	deleteNotice,
	getNotice,
	listNotices,
} from "@/lib/api/committee-notice";
import styles from "./index.module.scss";
import { NoticeFormDialog } from "./NoticeFormDialog";

type NoticeRow = {
	id: string;
	title: string;
	ownerName: string;
	collaborators: AvatarGroupItem[];
	createdAt: Date;
	updatedAt: Date;
	authorizationStatus: string[];
};

const authorizationStatusLabel = (
	status: NoticeAuthorizationStatus | null
): string => {
	if (!status) return "未申請";
	switch (status) {
		case "PENDING":
			return "承認待ち";
		case "APPROVED":
			return "承認済み";
		case "REJECTED":
			return "却下";
	}
};

const authorizationColorMap: Record<string, string> = {
	未申請: "gray",
	承認待ち: "orange",
	承認済み: "green",
	却下: "red",
};

const noticeColumnHelper = createColumnHelper<NoticeRow>();

export const Route = createFileRoute("/committee/notice/")({
	component: RouteComponent,
});

type NoticeDetail = GetNoticeResponse["notice"];

function RouteComponent() {
	const [notices, setNotices] = useState<NoticeRow[]>([]);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);

	// 詳細ダイアログ
	const [detailNotice, setDetailNotice] = useState<NoticeDetail | null>(null);

	// 編集ダイアログ
	const [editNotice, setEditNotice] = useState<{
		id: string;
		title: string;
		body: string;
	} | null>(null);

	// 削除確認ダイアログ
	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		title: string;
	} | null>(null);
	const [deleting, setDeleting] = useState(false);

	const fetchNotices = useCallback(async () => {
		try {
			const data = await listNotices();
			setNotices(
				data.notices.map(n => ({
					id: n.id,
					title: n.title,
					ownerName: n.owner.name,
					collaborators: n.collaborators.map(c => ({ name: c.name })),
					createdAt: new Date(n.createdAt),
					updatedAt: new Date(n.updatedAt),
					authorizationStatus: [
						authorizationStatusLabel(n.authorization?.status ?? null),
					],
				}))
			);
		} catch (err) {
			console.error(err);
			alert("お知らせの取得に失敗しました");
		}
	}, []);

	useEffect(() => {
		fetchNotices();
	}, [fetchNotices]);

	const handleTitleClick = async (id: string) => {
		try {
			const data = await getNotice(id);
			setDetailNotice(data.notice);
		} catch (err) {
			console.error(err);
			alert("お知らせの取得に失敗しました");
		}
	};

	const handleEditFromDetail = () => {
		if (!detailNotice) return;
		setDetailNotice(null);
		setEditNotice({
			id: detailNotice.id,
			title: detailNotice.title,
			body: detailNotice.body ?? "",
		});
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		setDeleting(true);
		try {
			await deleteNotice(deleteTarget.id);
			setDeleteTarget(null);
			fetchNotices();
		} catch (err) {
			console.error(err);
			alert("お知らせの削除に失敗しました");
		} finally {
			setDeleting(false);
		}
	};

	const columns = [
		noticeColumnHelper.accessor("title", {
			header: "タイトル",
			cell: info => (
				<button
					type="button"
					className={styles.titleLink}
					onClick={() => handleTitleClick(info.row.original.id)}
				>
					{info.getValue()}
				</button>
			),
		}),
		noticeColumnHelper.accessor("ownerName", {
			header: "オーナー",
			cell: NameCell,
		}),
		noticeColumnHelper.accessor("collaborators", {
			header: "共同編集者",
			cell: AvatarGroupCell,
		}),
		noticeColumnHelper.accessor("authorizationStatus", {
			header: "承認ステータス",
			cell: TagCell,
			meta: {
				tagColors: authorizationColorMap,
			},
		}),
		noticeColumnHelper.accessor("createdAt", {
			header: "作成日",
			cell: DateCell,
			meta: { dateFormat: "date" },
		}),
		noticeColumnHelper.accessor("updatedAt", {
			header: "更新日",
			cell: DateCell,
			meta: { dateFormat: "date" },
		}),
		noticeColumnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<Popover.Root>
					<Popover.Trigger>
						<IconButton aria-label="操作メニュー">
							<IconDotsVertical size={16} />
						</IconButton>
					</Popover.Trigger>
					<Popover.Content align="start" sideOffset={4}>
						<div className={styles.menu}>
							<Button
								intent="ghost"
								size="2"
								onClick={() =>
									handleTitleClick(row.original.id).then(() => {
										// 詳細から編集に遷移するため、ここでは詳細を開く
									})
								}
							>
								<IconEdit size={16} />
								編集
							</Button>
							<Button
								intent="ghost"
								size="2"
								onClick={() =>
									setDeleteTarget({
										id: row.original.id,
										title: row.original.title,
									})
								}
							>
								<IconTrash size={16} />
								削除
							</Button>
						</div>
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
						id: "createdAt",
						desc: true,
					},
				]}
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

			{/* 作成ダイアログ */}
			<NoticeFormDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onSuccess={fetchNotices}
			/>

			{/* 編集ダイアログ */}
			<NoticeFormDialog
				open={editNotice !== null}
				onOpenChange={open => {
					if (!open) setEditNotice(null);
				}}
				notice={editNotice ?? undefined}
				onSuccess={fetchNotices}
			/>

			{/* 詳細ダイアログ */}
			<Dialog.Root
				open={detailNotice !== null}
				onOpenChange={open => {
					if (!open) setDetailNotice(null);
				}}
			>
				<Dialog.Content maxWidth="560px">
					<Dialog.Title>{detailNotice?.title}</Dialog.Title>
					<Dialog.Description size="2" color="gray">
						{detailNotice?.owner.name} ・{" "}
						{detailNotice?.createdAt &&
							new Date(detailNotice.createdAt).toLocaleDateString("ja-JP", {
								year: "numeric",
								month: "2-digit",
								day: "2-digit",
							})}
					</Dialog.Description>

					{detailNotice?.body && (
						<div className={styles.noticeBody}>
							<RichTextContent content={detailNotice.body} />
						</div>
					)}

					{detailNotice && detailNotice.collaborators.length > 0 && (
						<div className={styles.detailSection}>
							<Text size="2" weight="medium">
								共同編集者
							</Text>
							<div className={styles.collaboratorList}>
								{detailNotice.collaborators.map(c => (
									<Badge key={c.id} variant="soft" color="gray">
										{c.user.name}
									</Badge>
								))}
							</div>
						</div>
					)}

					{detailNotice && detailNotice.authorizations.length > 0 && (
						<div className={styles.detailSection}>
							<Text size="2" weight="medium">
								承認履歴
							</Text>
							<div className={styles.authorizationList}>
								{detailNotice.authorizations.map(auth => (
									<div key={auth.id} className={styles.authorizationItem}>
										<Badge
											variant="soft"
											color={
												authorizationColorMap[
													authorizationStatusLabel(auth.status)
												] as "gray" | "orange" | "green" | "red"
											}
										>
											{authorizationStatusLabel(auth.status)}
										</Badge>
										<Text size="1" color="gray">
											申請先: {auth.requestedTo.name}
										</Text>
									</div>
								))}
							</div>
						</div>
					)}

					<div className={styles.dialogActions}>
						<Button
							intent="secondary"
							size="2"
							onClick={() => setDetailNotice(null)}
						>
							閉じる
						</Button>
						<Button intent="primary" size="2" onClick={handleEditFromDetail}>
							<IconEdit size={16} />
							編集
						</Button>
					</div>
				</Dialog.Content>
			</Dialog.Root>

			{/* 削除確認ダイアログ */}
			<Dialog.Root
				open={deleteTarget !== null}
				onOpenChange={open => {
					if (!open) setDeleteTarget(null);
				}}
			>
				<Dialog.Content maxWidth="400px">
					<Dialog.Title>お知らせを削除</Dialog.Title>
					<Dialog.Description size="2">
						「{deleteTarget?.title}」を削除しますか？この操作は取り消せません。
					</Dialog.Description>
					<div className={styles.dialogActions}>
						<Button
							intent="secondary"
							size="2"
							onClick={() => setDeleteTarget(null)}
						>
							キャンセル
						</Button>
						<Button
							intent="danger"
							size="2"
							onClick={handleDelete}
							disabled={deleting}
						>
							削除
						</Button>
					</div>
				</Dialog.Content>
			</Dialog.Root>
		</div>
	);
}
