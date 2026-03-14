import { Heading, Text } from "@radix-ui/themes";
import { IconPaperclip, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, TextArea } from "@/components/primitives";
import { uploadFile } from "@/lib/api/files";
import { formatFileSize } from "@/lib/format";
import styles from "./SupportDetail.module.scss";

type ReplyAction = "send" | "draft";

type AddCommentHandler = (
	body: string,
	fileIds?: string[],
	isDraft?: boolean
) => Promise<void>;

async function resolveReplyFileIds(replyFiles: File[]) {
	if (replyFiles.length === 0) {
		return undefined;
	}
	const results = await Promise.all(replyFiles.map(file => uploadFile(file)));
	return results.map(result => result.file.id);
}

function getReplyErrorMessage(isDraft: boolean) {
	return isDraft
		? "下書きの保存に失敗しました"
		: "コメントの送信に失敗しました";
}

function ReplySelectedFiles({
	files,
	onRemove,
}: {
	files: File[];
	onRemove: (index: number) => void;
}) {
	if (files.length === 0) {
		return null;
	}
	return (
		<div className={styles.selectedFiles}>
			{files.map((file, index) => (
				<div key={`${file.name}-${index}`} className={styles.selectedFileItem}>
					<IconPaperclip size={14} />
					<Text size="1">{file.name}</Text>
					<Text size="1" color="gray">
						({formatFileSize(file.size)})
					</Text>
					<button
						type="button"
						className={styles.selectedFileRemove}
						onClick={() => onRemove(index)}
					>
						<IconX size={12} />
					</button>
				</div>
			))}
		</div>
	);
}

function ReplyFilePicker({
	inputRef,
	onChange,
	disabled,
}: {
	inputRef: React.RefObject<HTMLInputElement | null>;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	disabled: boolean;
}) {
	return (
		<div className={styles.replyFileArea}>
			<input
				ref={inputRef}
				type="file"
				multiple
				className={styles.fileInput}
				onChange={onChange}
			/>
			<button
				type="button"
				className={styles.fileSelectButton}
				onClick={() => inputRef.current?.click()}
				disabled={disabled}
			>
				<IconPaperclip size={16} />
				<Text size="2">ファイルを添付</Text>
			</button>
		</div>
	);
}

function ReplyActionButtons({
	enableDraft,
	disabled,
	replySending,
	replyAction,
	hasReplyText,
	onSubmit,
}: {
	enableDraft: boolean;
	disabled?: boolean;
	replySending: boolean;
	replyAction: ReplyAction | null;
	hasReplyText: boolean;
	onSubmit: (isDraft?: boolean) => void;
}) {
	const submitDisabled = disabled || !hasReplyText || replySending;
	if (!enableDraft) {
		return (
			<Button onClick={() => onSubmit(false)} disabled={submitDisabled}>
				{replySending && replyAction === "send" ? "送信中..." : "送信"}
			</Button>
		);
	}

	return (
		<>
			<Button
				intent="secondary"
				onClick={() => onSubmit(true)}
				disabled={submitDisabled}
			>
				{replySending && replyAction === "draft" ? "保存中..." : "下書き保存"}
			</Button>
			<Button onClick={() => onSubmit(false)} disabled={submitDisabled}>
				{replySending && replyAction === "send" ? "送信中..." : "送信"}
			</Button>
		</>
	);
}

export function ReplySection({
	onAddComment,
	disabled,
	enableDraft = false,
}: {
	onAddComment: AddCommentHandler;
	disabled?: boolean;
	enableDraft?: boolean;
}) {
	const [replyText, setReplyText] = useState("");
	const [replyFiles, setReplyFiles] = useState<File[]>([]);
	const [replySending, setReplySending] = useState(false);
	const [replyAction, setReplyAction] = useState<ReplyAction | null>(null);
	const replyFileInputRef = useRef<HTMLInputElement>(null);
	const trimmedReplyText = replyText.trim();
	const hasReplyText = trimmedReplyText.length > 0;

	const handleSubmitReply = async (isDraft = false) => {
		if (!hasReplyText || disabled) return;
		setReplyAction(isDraft ? "draft" : "send");
		setReplySending(true);
		try {
			const fileIds = await resolveReplyFileIds(replyFiles);
			await onAddComment(trimmedReplyText, fileIds, isDraft);
			setReplyText("");
			setReplyFiles([]);
		} catch {
			toast.error(getReplyErrorMessage(isDraft));
		} finally {
			setReplySending(false);
			setReplyAction(null);
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
			<Heading size="3">コメント送信</Heading>
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
			{!disabled && (
				<ReplySelectedFiles files={replyFiles} onRemove={removeReplyFile} />
			)}
			{!disabled && (
				<ReplyFilePicker
					inputRef={replyFileInputRef}
					onChange={handleReplyFileSelect}
					disabled={replySending}
				/>
			)}
			<div className={styles.replyActions}>
				<ReplyActionButtons
					enableDraft={enableDraft}
					disabled={disabled}
					replySending={replySending}
					replyAction={replyAction}
					hasReplyText={hasReplyText}
					onSubmit={handleSubmitReply}
				/>
			</div>
		</section>
	);
}
