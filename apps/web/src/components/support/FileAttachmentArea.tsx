import { Text } from "@radix-ui/themes";
import { fileAcceptAttribute } from "@sos26/shared";
import { IconPaperclip, IconX } from "@tabler/icons-react";
import { formatFileSize } from "@/lib/format";
import styles from "./NewInquiryForm.module.scss";

export type ExistingAttachment = {
	id: string;
	fileName: string;
	size: number;
};

export function FileAttachmentArea({
	fileInputRef,
	selectedFiles,
	onFileSelect,
	onRemoveFile,
	existingAttachments,
	onRemoveExistingAttachment,
	error,
}: {
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	selectedFiles: File[];
	onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onRemoveFile: (index: number) => void;
	existingAttachments?: ExistingAttachment[];
	onRemoveExistingAttachment?: (attachmentId: string) => void;
	error?: string | null;
}) {
	const hasAny =
		selectedFiles.length > 0 ||
		(existingAttachments && existingAttachments.length > 0);

	return (
		<div className={styles.fileSelectArea}>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept={fileAcceptAttribute}
				className={styles.fileInput}
				onChange={onFileSelect}
			/>
			<button
				type="button"
				className={styles.fileSelectButton}
				onClick={() => fileInputRef.current?.click()}
			>
				<IconPaperclip size={14} />
				<Text size="2">ファイルを添付</Text>
			</button>
			{error && (
				<Text size="2" color="red">
					{error}
				</Text>
			)}
			{hasAny && (
				<div className={styles.selectedFileList}>
					{existingAttachments?.map(att => (
						<div key={att.id} className={styles.selectedFileItem}>
							<IconPaperclip size={14} />
							<Text size="1">{att.fileName}</Text>
							<Text size="1" color="gray">
								({formatFileSize(att.size)})
							</Text>
							{onRemoveExistingAttachment && (
								<button
									type="button"
									className={styles.selectedFileRemove}
									onClick={() => onRemoveExistingAttachment(att.id)}
								>
									<IconX size={12} />
								</button>
							)}
						</div>
					))}
					{selectedFiles.map((f, i) => (
						<div key={`${f.name}-${i}`} className={styles.selectedFileItem}>
							<IconPaperclip size={14} />
							<Text size="1">{f.name}</Text>
							<Text size="1" color="gray">
								({formatFileSize(f.size)})
							</Text>
							<button
								type="button"
								className={styles.selectedFileRemove}
								onClick={() => onRemoveFile(i)}
							>
								<IconX size={12} />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
