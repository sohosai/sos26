import { Dialog, Text } from "@radix-ui/themes";
import type { GetNoticeResponse } from "@sos26/shared";
import { IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button, IconButton } from "@/components/primitives";
import { getNotice } from "@/lib/api/committee-notice";
import styles from "./NoticeDetailDialog.module.scss";

type NoticeDetail = GetNoticeResponse["notice"];

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

	useEffect(() => {
		if (!noticeId) {
			setNotice(null);
			return;
		}
		setIsLoading(true);
		getNotice(noticeId)
			.then(res => setNotice(res.notice))
			.catch(console.error)
			.finally(() => setIsLoading(false));
	}, [noticeId]);

	const isOwner = notice?.ownerId === currentUserId;
	const isCollaborator =
		notice?.collaborators.some(c => c.user.id === currentUserId) ?? false;
	const canEdit = isOwner || isCollaborator;

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
							<Text size="2" color="gray">
								本文なし
							</Text>
						)}
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
