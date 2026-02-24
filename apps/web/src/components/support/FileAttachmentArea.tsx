import { Text } from "@radix-ui/themes";
import { IconPaperclip, IconX } from "@tabler/icons-react";
import { formatFileSize } from "@/lib/format";
import styles from "./NewInquiryForm.module.scss";

export function FileAttachmentArea({
	fileInputRef,
	selectedFiles,
	onFileSelect,
	onRemoveFile,
}: {
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	selectedFiles: File[];
	onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onRemoveFile: (index: number) => void;
}) {
	return (
		<div className={styles.fileSelectArea}>
			<input
				ref={fileInputRef}
				type="file"
				multiple
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
