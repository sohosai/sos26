import { Dialog, Text } from "@radix-ui/themes";
import type { GetNoticeResponse } from "@sos26/shared";
import { IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useEffect, useState } from "react";
import { Button, IconButton, Select } from "@/components/primitives";
import { listCommitteeMembers } from "@/lib/api/committee-member";
import {
	addCollaborator,
	getNotice,
	removeCollaborator,
} from "@/lib/api/committee-notice";
import styles from "./NoticeDetailDialog.module.scss";

type NoticeDetail = GetNoticeResponse["notice"];
type CommitteeMember = {
	id: string;
	userId: string;
	user: { id: string; name: string };
};

// ─────────────────────────────────────────────────────────────
// 共同編集者セクション
// ─────────────────────────────────────────────────────────────

type CollaboratorsSectionProps = {
	notice: NoticeDetail;
	isOwner: boolean;
	availableMembers: CommitteeMember[];
	removingId: string | null;
	isAdding: boolean;
	selectedUserId: string;
	onSelectedUserIdChange: (id: string) => void;
	onAdd: () => void;
	onRemove: (collaboratorId: string) => void;
};

function CollaboratorsSection({
	notice,
	isOwner,
	availableMembers,
	removingId,
	isAdding,
	selectedUserId,
	onSelectedUserIdChange,
	onAdd,
	onRemove,
}: CollaboratorsSectionProps) {
	return (
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
									onClick={() => onRemove(c.id)}
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
						onValueChange={onSelectedUserIdChange}
						placeholder="追加するメンバーを選択"
						size="2"
						disabled={availableMembers.length === 0}
					/>
					<Button
						intent="secondary"
						size="2"
						onClick={onAdd}
						loading={isAdding}
						disabled={!selectedUserId}
					>
						<IconPlus size={14} />
						追加
					</Button>
				</div>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// 詳細ダイアログ
// ─────────────────────────────────────────────────────────────

type Props = {
	noticeId: string | null;
	currentUserId: string;
	onClose: () => void;
	onEdit: (notice: NoticeDetail) => void;
	onDelete: (noticeId: string) => void;
};

export function NoticeDetailDialog({
	noticeId,
	currentUserId,
	onClose,
	onEdit,
	onDelete,
}: Props) {
	const [notice, setNotice] = useState<NoticeDetail | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>(
		[]
	);
	const [selectedUserId, setSelectedUserId] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);

	useEffect(() => {
		if (!noticeId) {
			setNotice(null);
			setCommitteeMembers([]);
			return;
		}
		setIsLoading(true);
		Promise.all([getNotice(noticeId), listCommitteeMembers()])
			.then(([noticeRes, membersRes]) => {
				setNotice(noticeRes.notice);
				setCommitteeMembers(membersRes.committeeMembers);
			})
			.catch(console.error)
			.finally(() => setIsLoading(false));
	}, [noticeId]);

	const isOwner = notice?.ownerId === currentUserId;
	const isCollaborator =
		notice?.collaborators.some(c => c.user.id === currentUserId) ?? false;
	const canEdit = isOwner || isCollaborator;

	const collaboratorUserIds = new Set(
		notice?.collaborators.map(c => c.user.id) ?? []
	);
	const availableMembers = committeeMembers.filter(
		m => m.user.id !== notice?.ownerId && !collaboratorUserIds.has(m.user.id)
	);

	const refreshNotice = async (id: string) => {
		const res = await getNotice(id);
		setNotice(res.notice);
	};

	const handleAddCollaborator = async () => {
		if (!notice || !selectedUserId) return;
		setIsAdding(true);
		try {
			await addCollaborator(notice.id, { userId: selectedUserId });
			setSelectedUserId("");
			await refreshNotice(notice.id);
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
			await refreshNotice(notice.id);
		} catch (error) {
			console.error(error);
		} finally {
			setRemovingId(null);
		}
	};

	return (
		<Dialog.Root
			open={noticeId !== null}
			onOpenChange={open => {
				if (!open) onClose();
			}}
		>
			<Dialog.Content maxWidth="640px">
				<div className={styles.header}>
					<Dialog.Title mb="0">
						{isLoading ? "読み込み中..." : (notice?.title ?? "")}
					</Dialog.Title>
					<IconButton aria-label="閉じる" onClick={onClose}>
						<IconX size={16} />
					</IconButton>
				</div>

				{isLoading ? (
					<Text size="2" color="gray">
						読み込み中...
					</Text>
				) : notice ? (
					<>
						<Text as="p" size="1" color="gray" mb="4">
							{notice.owner.name} ・{" "}
							{notice.updatedAt.toLocaleDateString("ja-JP")}
						</Text>

						{notice.body ? (
							<div
								className={styles.body}
								// お知らせ本文はRichTextEditorで入力されたHTMLを表示するため必要
								// biome-ignore lint:security/noDangerouslySetInnerHtml
								dangerouslySetInnerHTML={{ __html: notice.body }}
							/>
						) : (
							<Text size="2" color="gray" mb="4">
								本文なし
							</Text>
						)}

						<CollaboratorsSection
							notice={notice}
							isOwner={isOwner}
							availableMembers={availableMembers}
							removingId={removingId}
							isAdding={isAdding}
							selectedUserId={selectedUserId}
							onSelectedUserIdChange={setSelectedUserId}
							onAdd={handleAddCollaborator}
							onRemove={handleRemoveCollaborator}
						/>
					</>
				) : null}

				<div className={styles.actions}>
					{canEdit && (
						<Button
							intent="secondary"
							size="2"
							onClick={() => {
								if (notice) onEdit(notice);
							}}
						>
							編集
						</Button>
					)}
					{isOwner && (
						<Button
							intent="danger"
							size="2"
							onClick={() => {
								if (notice) onDelete(notice.id);
							}}
						>
							削除
						</Button>
					)}
					<Button intent="secondary" size="2" onClick={onClose}>
						閉じる
					</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
