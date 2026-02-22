import { Dialog, Text } from "@radix-ui/themes";
import type { Bureau, NoticeAttachment } from "@sos26/shared";
import { bureauLabelMap } from "@sos26/shared";
import { IconDownload, IconPaperclip } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import { getAuthenticatedFileUrl, getFileContentUrl } from "@/lib/api/files";
import { getProjectNotice, readProjectNotice } from "@/lib/api/project-notice";
import { formatDate } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize";
import styles from "./NoticeDetailDialog.module.scss";

const getBureauLabel = (bureau: string): string =>
	bureauLabelMap[bureau as Bureau] ?? bureau;

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
	noticeId: string | null;
	projectId: string;
	onClose: () => void;
	onRead: (noticeId: string) => void;
};

export function NoticeDetailDialog({
	noticeId,
	projectId,
	onClose,
	onRead,
}: Props) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState<string | null>(null);
	const [meta, setMeta] = useState("");
	const [attachments, setAttachments] = useState<NoticeAttachment[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (!noticeId) return;
		let cancelled = false;
		setIsLoading(true);

		getProjectNotice(projectId, noticeId)
			.then(res => {
				if (cancelled) return;
				setTitle(res.notice.title);
				setBody(res.notice.body);
				setMeta(
					`${formatDate(new Date(res.notice.deliveredAt), "datetime")}　${getBureauLabel(res.notice.ownerBureau)}`
				);
				setAttachments(res.notice.attachments);

				if (!res.notice.isRead) {
					readProjectNotice(projectId, noticeId).then(() => {
						if (!cancelled) onRead(noticeId);
					});
				}
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
	}, [noticeId, projectId, onRead]);

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

	const handleDownloadAttachment = async (
		fileId: string,
		isPublic: boolean
	) => {
		try {
			const url = isPublic
				? getFileContentUrl(fileId)
				: await getAuthenticatedFileUrl(fileId);
			window.open(url, "_blank");
		} catch {
			toast.error("ファイルの取得に失敗しました");
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
										<button
											key={att.id}
											type="button"
											className={styles.attachmentItem}
											onClick={() =>
												handleDownloadAttachment(att.fileId, att.isPublic)
											}
										>
											<IconDownload size={14} />
											<Text size="2">{att.fileName}</Text>
											<Text size="1" color="gray">
												({formatFileSize(att.size)})
											</Text>
										</button>
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
