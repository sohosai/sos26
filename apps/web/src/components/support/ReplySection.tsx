import { Heading, Text } from "@radix-ui/themes";
import { IconPaperclip, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, TextArea } from "@/components/primitives";
import { uploadFile } from "@/lib/api/files";
import { formatFileSize } from "@/lib/format";
import styles from "./SupportDetail.module.scss";

export function ReplySection({
	onAddComment,
	disabled,
}: {
	onAddComment: (body: string, fileIds?: string[]) => Promise<void>;
	disabled?: boolean;
}) {
	const [replyText, setReplyText] = useState("");
	const [replyFiles, setReplyFiles] = useState<File[]>([]);
	const [replySending, setReplySending] = useState(false);
	const replyFileInputRef = useRef<HTMLInputElement>(null);

	const handleSubmitReply = async () => {
		if (!replyText.trim() || disabled) return;
		setReplySending(true);
		try {
			let fileIds: string[] | undefined;
			if (replyFiles.length > 0) {
				const results = await Promise.all(replyFiles.map(f => uploadFile(f)));
				fileIds = results.map(r => r.file.id);
			}
			await onAddComment(replyText.trim(), fileIds);
			setReplyText("");
			setReplyFiles([]);
		} catch {
			toast.error("コメントの送信に失敗しました");
		} finally {
			setReplySending(false);
		}
	};

	const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { files } = e.target;
		if (files) {
			setReplyFiles(prev => [...prev, ...Array.from(files)]);
		}
		e.target.value = "";
	};

	const removeReplyFile = (index: number) => {
		setReplyFiles(prev => prev.filter((_, i) => i !== index));
	};

	return (
		<section className={styles.replySection}>
			<Heading size="3">コメントを追加</Heading>
			{disabled && (
				<Text size="2" color="gray">
					閲覧権限のため、コメントを送信できません。
				</Text>
			)}
			<TextArea
				label="返信内容"
				placeholder="返信内容を入力..."
				value={replyText}
				onChange={setReplyText}
				rows={3}
				disabled={disabled}
			/>
			{!disabled && replyFiles.length > 0 && (
				<div className={styles.selectedFiles}>
					{replyFiles.map((f, i) => (
						<div key={`${f.name}-${i}`} className={styles.selectedFileItem}>
							<IconPaperclip size={14} />
							<Text size="1">{f.name}</Text>
							<Text size="1" color="gray">
								({formatFileSize(f.size)})
							</Text>
							<button
								type="button"
								className={styles.selectedFileRemove}
								onClick={() => removeReplyFile(i)}
							>
								<IconX size={12} />
							</button>
						</div>
					))}
				</div>
			)}
			{!disabled && (
				<div className={styles.replyFileArea}>
					<input
						ref={replyFileInputRef}
						type="file"
						multiple
						className={styles.fileInput}
						onChange={handleReplyFileSelect}
					/>
					<button
						type="button"
						className={styles.fileSelectButton}
						onClick={() => replyFileInputRef.current?.click()}
						disabled={replySending}
					>
						<IconPaperclip size={16} />
						<Text size="2">ファイルを添付</Text>
					</button>
				</div>
			)}
			<div className={styles.replyActions}>
				<Button
					onClick={handleSubmitReply}
					disabled={disabled || !replyText.trim() || replySending}
				>
					{replySending ? "送信中..." : "送信"}
				</Button>
			</div>
		</section>
	);
}
