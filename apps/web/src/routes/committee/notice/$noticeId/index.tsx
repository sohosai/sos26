import { AlertDialog, Heading, Text } from "@radix-ui/themes";
import type { GetNoticeResponse } from "@sos26/shared";
import { IconArrowLeft, IconPlus, IconTrash } from "@tabler/icons-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import Avatar from "boring-avatars";
import { useCallback, useEffect, useState } from "react";
import { Button, IconButton, Select } from "@/components/primitives";
import { listCommitteeMembers } from "@/lib/api/committee-member";
import {
	addCollaborator,
	deleteNotice,
	getNotice,
	removeCollaborator,
} from "@/lib/api/committee-notice";
import { useAuthStore } from "@/lib/auth";
import { CreateNoticeDialog } from "../CreateNoticeDialog";
import styles from "./index.module.scss";

type NoticeDetail = GetNoticeResponse["notice"];
type CommitteeMember = {
	id: string;
	userId: string;
	user: { id: string; name: string };
};

export const Route = createFileRoute("/committee/notice/$noticeId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { noticeId } = Route.useParams();
	const navigate = useNavigate();
	const { user } = useAuthStore();

	const [notice, setNotice] = useState<NoticeDetail | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>(
		[]
	);

	// 共同編集者
	const [selectedUserId, setSelectedUserId] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);

	// 編集ダイアログ
	const [editDialogOpen, setEditDialogOpen] = useState(false);

	// 削除確認
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const fetchNotice = useCallback(async () => {
		setIsLoading(true);
		try {
			const [noticeRes, membersRes] = await Promise.all([
				getNotice(noticeId),
				listCommitteeMembers(),
			]);
			setNotice(noticeRes.notice);
			setCommitteeMembers(membersRes.committeeMembers);
		} catch (error) {
			console.error(error);
		} finally {
			setIsLoading(false);
		}
	}, [noticeId]);

	useEffect(() => {
		fetchNotice();
	}, [fetchNotice]);

	const isOwner = notice?.ownerId === user?.id;
	const isCollaborator =
		notice?.collaborators.some(c => c.user.id === user?.id) ?? false;
	const canEdit = isOwner || isCollaborator;

	const collaboratorUserIds = new Set(
		notice?.collaborators.map(c => c.user.id) ?? []
	);
	const availableMembers = committeeMembers.filter(
		m => m.user.id !== notice?.ownerId && !collaboratorUserIds.has(m.user.id)
	);

	const handleAddCollaborator = async () => {
		if (!notice || !selectedUserId) return;
		setIsAdding(true);
		try {
			await addCollaborator(notice.id, { userId: selectedUserId });
			setSelectedUserId("");
			const res = await getNotice(notice.id);
			setNotice(res.notice);
		} catch (error) {
			console.error(error);
		} finally {
			setIsAdding(false);
		}
	};

	const handleRemoveCollaborator = async (collaboratorId: string) => {
		if (!notice) return;
		setRemovingId(collaboratorId);
		try {
			await removeCollaborator(notice.id, collaboratorId);
			const res = await getNotice(notice.id);
			setNotice(res.notice);
		} catch (error) {
			console.error(error);
		} finally {
			setRemovingId(null);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteNotice(noticeId);
			navigate({ to: "/committee/notice" });
		} catch (error) {
			console.error(error);
		} finally {
			setIsDeleting(false);
		}
	};

	if (isLoading) {
		return (
			<div>
				<Text size="2" color="gray">
					読み込み中...
				</Text>
			</div>
		);
	}

	if (!notice) {
		return (
			<div>
				<Text size="2" color="gray">
					お知らせが見つかりませんでした。
				</Text>
				<Link to="/committee/notice">
					<Button intent="ghost" size="2">
						<IconArrowLeft size={16} />
						一覧に戻る
					</Button>
				</Link>
			</div>
		);
	}

	return (
		<div>
			<Link to="/committee/notice">
				<Button intent="ghost" size="2">
					<IconArrowLeft size={16} />
					一覧に戻る
				</Button>
			</Link>

			<div className={styles.header}>
				<div className={styles.headerTitle}>
					<Heading size="6">{notice.title}</Heading>
					<Text as="p" size="2" color="gray">
						{notice.owner.name} ・{" "}
						{notice.updatedAt.toLocaleDateString("ja-JP")}
					</Text>
				</div>
				<div className={styles.headerActions}>
					{canEdit && (
						<Button
							intent="secondary"
							size="2"
							onClick={() => setEditDialogOpen(true)}
						>
							編集
						</Button>
					)}
					{isOwner && (
						<Button
							intent="danger"
							size="2"
							onClick={() => setDeleteConfirmOpen(true)}
						>
							削除
						</Button>
					)}
				</div>
			</div>

			{/* 本文 */}
			{notice.body ? (
				<div
					className={styles.body}
					// お知らせ本文はRichTextEditorで入力されたHTMLを表示するため必要
					// biome-ignore lint:security/noDangerouslySetInnerHtml
					dangerouslySetInnerHTML={{ __html: notice.body }}
				/>
			) : (
				<Text size="2" color="gray">
					本文なし
				</Text>
			)}

			{/* 共同編集者 */}
			<div className={styles.collaboratorsSection}>
				<Text size="2" weight="medium">
					共同編集者
				</Text>

				{notice.collaborators.length === 0 ? (
					<Text size="2" color="gray">
						共同編集者なし
					</Text>
				) : (
					<ul className={styles.collaboratorList}>
						{notice.collaborators.map(c => (
							<li key={c.id} className={styles.collaboratorItem}>
								<Avatar size={20} name={c.user.name} variant="beam" />
								<Text size="2">{c.user.name}</Text>
								{isOwner && (
									<IconButton
										aria-label={`${c.user.name}を削除`}
										onClick={() => handleRemoveCollaborator(c.id)}
										disabled={removingId === c.id}
									>
										<IconTrash size={14} />
									</IconButton>
								)}
							</li>
						))}
					</ul>
				)}

				{isOwner && (
					<div className={styles.addCollaborator}>
						<Select
							options={availableMembers.map(m => ({
								value: m.user.id,
								label: m.user.name,
							}))}
							value={selectedUserId}
							onValueChange={setSelectedUserId}
							placeholder="追加するメンバーを選択"
							size="2"
							disabled={availableMembers.length === 0}
						/>
						<Button
							intent="secondary"
							size="2"
							onClick={handleAddCollaborator}
							loading={isAdding}
							disabled={!selectedUserId}
						>
							<IconPlus size={14} />
							追加
						</Button>
					</div>
				)}
			</div>

			{/* 編集ダイアログ */}
			<CreateNoticeDialog
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				noticeId={notice.id}
				initialValues={{ title: notice.title, body: notice.body ?? "" }}
				onSuccess={fetchNotice}
			/>

			{/* 削除確認ダイアログ */}
			<AlertDialog.Root
				open={deleteConfirmOpen}
				onOpenChange={setDeleteConfirmOpen}
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
