import { Text } from "@radix-ui/themes";
import { fileAcceptAttribute } from "@sos26/shared";
import { IconPaperclip, IconX } from "@tabler/icons-react";
import { formatFileSize } from "@/lib/format";
import styles from "./NewInquiryForm.module.scss";

export function FileAttachmentArea({
	fileInputRef,
	selectedFiles,
	onFileSelect,
	onRemoveFile,
	error,
}: {
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	selectedFiles: File[];
	onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onRemoveFile: (index: number) => void;
	error?: string | null;
}) {
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
			{selectedFiles.length > 0 && (
				<div className={styles.selectedFileList}>
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
