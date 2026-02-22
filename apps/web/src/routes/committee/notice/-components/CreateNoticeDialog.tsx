import { Dialog, Text } from "@radix-ui/themes";
import type { NoticeAttachment } from "@sos26/shared";
import { allowedMimeTypes } from "@sos26/shared";
import { IconPaperclip, IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { RichTextEditor } from "@/components/patterns";
import { Button, IconButton, TextField } from "@/components/primitives";
import {
	addNoticeAttachments,
	createNotice,
	removeNoticeAttachment,
	updateNotice,
} from "@/lib/api/committee-notice";
import { uploadFile } from "@/lib/api/files";
import styles from "./CreateNoticeDialog.module.scss";

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 編集モード時に指定 */
	noticeId?: string;
	initialValues?: { title: string; body: string };
	initialAttachments?: NoticeAttachment[];
	onSuccess?: () => void;
};

export function CreateNoticeDialog({
	open,
	onOpenChange,
	noticeId,
	initialValues,
	initialAttachments,
	onSuccess,
}: Props) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 添付ファイル管理
	const [newFiles, setNewFiles] = useState<File[]>([]);
	const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>(
		[]
	);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const isEdit = noticeId !== undefined;

	const existingAttachments = (initialAttachments ?? []).filter(
		a => !removedAttachmentIds.includes(a.id)
	);

	useEffect(() => {
		if (open) {
			setTitle(initialValues?.title ?? "");
			setBody(initialValues?.body ?? "");
			setError(null);
			setNewFiles([]);
			setRemovedAttachmentIds([]);
		}
	}, [open, initialValues]);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files) {
			setNewFiles(prev => [...prev, ...Array.from(files)]);
		}
		// input をリセットして同じファイルを再選択可能に
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleRemoveNewFile = (index: number) => {
		setNewFiles(prev => prev.filter((_, i) => i !== index));
	};

	const handleMarkRemoveAttachment = (attachmentId: string) => {
		setRemovedAttachmentIds(prev => [...prev, attachmentId]);
	};

	const handleSubmit = async () => {
		setIsLoading(true);
		setError(null);
		try {
			let targetNoticeId: string;

			if (isEdit) {
				await updateNotice(noticeId, { title, body });
				targetNoticeId = noticeId;
			} else {
				const res = await createNotice({ title, body });
				targetNoticeId = res.notice.id;
			}

			// 新規ファイルのアップロード & 添付
			if (newFiles.length > 0) {
				const uploadResults = await Promise.all(
					newFiles.map(file => uploadFile(file))
				);
				const fileIds = uploadResults.map(r => r.file.id);
				await addNoticeAttachments(targetNoticeId, { fileIds });
			}

			// 削除マークされた既存添付ファイルを削除
			if (removedAttachmentIds.length > 0) {
				await Promise.all(
					removedAttachmentIds.map(id =>
						removeNoticeAttachment(targetNoticeId, id)
					)
				);
			}

			onSuccess?.();
			onOpenChange(false);
		} catch {
			setError(
				isEdit
					? "お知らせの保存に失敗しました。"
					: "お知らせの作成に失敗しました。"
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="540px">
				<div className={styles.dialogHeader}>
					<Dialog.Title mb="0">
						{isEdit ? "お知らせを編集" : "お知らせを作成"}
					</Dialog.Title>
					<IconButton aria-label="閉じる" onClick={() => onOpenChange(false)}>
						<IconX size={16} />
					</IconButton>
				</div>

				<div className={styles.form}>
					<TextField
						label="タイトル"
						placeholder="お知らせのタイトルを入力"
						value={title}
						onChange={setTitle}
						required
					/>
					<RichTextEditor
						label="本文"
						placeholder="お知らせの本文を入力"
						value={body}
						onChange={setBody}
						required
					/>

					{/* 添付ファイルセクション */}
					<div className={styles.attachmentSection}>
						<Text size="2" weight="medium">
							添付ファイル
						</Text>

						{/* 既存添付ファイル一覧（編集モード時） */}
						{existingAttachments.length > 0 && (
							<div className={styles.fileList}>
								{existingAttachments.map(att => (
									<div key={att.id} className={styles.fileItem}>
										<div className={styles.fileInfo}>
											<IconPaperclip size={14} />
											<Text size="2" truncate>
												{att.fileName}
											</Text>
											<Text size="1" color="gray">
												({formatFileSize(att.size)})
											</Text>
										</div>
										<IconButton
											aria-label="削除"
											size="1"
											onClick={() => handleMarkRemoveAttachment(att.id)}
										>
											<IconTrash size={14} />
										</IconButton>
									</div>
								))}
							</div>
						)}

						{/* 新規選択ファイル一覧 */}
						{newFiles.length > 0 && (
							<div className={styles.fileList}>
								{newFiles.map((file, index) => (
									<div
										key={`${file.name}-${index}`}
										className={styles.fileItem}
									>
										<div className={styles.fileInfo}>
											<IconPaperclip size={14} />
											<Text size="2" truncate>
												{file.name}
											</Text>
											<Text size="1" color="gray">
												({formatFileSize(file.size)})
											</Text>
										</div>
										<IconButton
											aria-label="取消"
											size="1"
											onClick={() => handleRemoveNewFile(index)}
										>
											<IconX size={14} />
										</IconButton>
									</div>
								))}
							</div>
						)}

						<input
							ref={fileInputRef}
							type="file"
							multiple
							accept={allowedMimeTypes.join(",")}
							onChange={handleFileSelect}
							className={styles.fileInput}
						/>
						<Button
							intent="secondary"
							onClick={() => fileInputRef.current?.click()}
						>
							<IconPaperclip size={14} />
							ファイルを選択
						</Button>
					</div>

					{error && (
						<Text size="2" color="red">
							{error}
						</Text>
					)}
					<div className={styles.actions}>
						<Button
							intent="secondary"
							size="2"
							onClick={() => onOpenChange(false)}
							disabled={isLoading}
						>
							キャンセル
						</Button>
						<Button
							intent="primary"
							size="2"
							onClick={handleSubmit}
							loading={isLoading}
							disabled={!title.trim() || !body.replace(/<[^>]*>/g, "").trim()}
						>
							{isEdit ? "保存" : "作成"}
						</Button>
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
