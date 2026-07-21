import { Dialog, Text } from "@radix-ui/themes";
import type {
	Bureau,
	GetProjectNoticeResponse,
	NoticeAttachment,
} from "@sos26/shared";
import { bureauLabelMap } from "@sos26/shared";
import { IconPaperclip } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AttachmentPreviewButton } from "@/components/filePreview/AttachmentPreviewButton";
import { Button } from "@/components/primitives";
import { getProjectNotice, readProjectNotice } from "@/lib/api/project-notice";
import { formatDate } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize";
import styles from "./NoticeDetailDialog.module.scss";

const getBureauLabel = (bureau: string): string =>
	bureauLabelMap[bureau as Bureau] ?? bureau;

type Props = {
	noticeId: string | null;
	projectId: string | null;
	initialNotice?: GetProjectNoticeResponse["notice"] | null;
	onClose: () => void;
	onRead: (noticeId: string) => void;
};

export function NoticeDetailDialog({
	noticeId,
	projectId,
	initialNotice,
	onClose,
	onRead,
}: Props) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState<string | null>(null);
	const [meta, setMeta] = useState("");
	const [attachments, setAttachments] = useState<NoticeAttachment[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (!noticeId || !projectId) return;
		let cancelled = false;

		const applyNotice = (notice: GetProjectNoticeResponse["notice"]) => {
			setTitle(notice.title);
			setBody(notice.body);
			setMeta(
				`${formatDate(new Date(notice.deliveredAt), "datetime")} ${getBureauLabel(notice.ownerBureau)}`
			);
			setAttachments(notice.attachments);

			if (!notice.isRead) {
				readProjectNotice(projectId, notice.id).then(() => {
					if (!cancelled) onRead(notice.id);
				});
			}
		};

		if (initialNotice?.id === noticeId) {
			applyNotice(initialNotice);
			setIsLoading(false);
			return () => {
				cancelled = true;
			};
		}

		setIsLoading(true);

		getProjectNotice(projectId, noticeId)
			.then(res => {
				if (cancelled) return;
				applyNotice(res.notice);
			})
			.catch(() => {
				if (!cancelled) toast.error("お知らせの取得に失敗しました");
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [noticeId, projectId, initialNotice, onRead]);

	const sanitizedBody = useMemo(
		() => (body ? sanitizeHtml(body) : null),
		[body]
	);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose();
			setTitle("");
			setBody(null);
			setMeta("");
			setAttachments([]);
		}
	};

	return (
		<Dialog.Root open={noticeId !== null} onOpenChange={handleOpenChange}>
			<Dialog.Content className={styles.content}>
				{isLoading ? (
					<Text size="2" color="gray">
						読み込み中...
					</Text>
				) : (
					<>
						<Dialog.Title>{title}</Dialog.Title>
						<Dialog.Description size="2" color="gray">
							{meta}
						</Dialog.Description>
						<hr className={styles.divider} />
						{sanitizedBody ? (
							<div
								className={styles.body}
								// biome-ignore lint/security/noDangerouslySetInnerHtml: サニタイズ済みHTML
								dangerouslySetInnerHTML={{ __html: sanitizedBody }}
							/>
						) : (
							<Text as="p" size="2" color="gray" mt="4">
								本文なし
							</Text>
						)}

						{attachments.length > 0 && (
							<div className={styles.attachmentSection}>
								<Text size="2" weight="medium" color="gray">
									<IconPaperclip
										size={14}
										style={{ verticalAlign: "middle" }}
									/>{" "}
									添付ファイル
								</Text>
								<div className={styles.attachmentList}>
									{attachments.map(att => (
										<AttachmentPreviewButton key={att.id} attachment={att} />
									))}
								</div>
							</div>
						)}

						<div className={styles.actions}>
							<Dialog.Close>
								<Button intent="secondary">閉じる</Button>
							</Dialog.Close>
						</div>
					</>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
}
