import { Dialog } from "@radix-ui/themes";
import { IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { RichTextEditor } from "@/components/patterns";
import { Button, IconButton, TextField } from "@/components/primitives";
import { createNotice, updateNotice } from "@/lib/api/committee-notice";
import styles from "./CreateNoticeDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 編集モード時に指定 */
	noticeId?: string;
	initialValues?: { title: string; body: string };
	onSuccess?: () => void;
};

export function CreateNoticeDialog({
	open,
	onOpenChange,
	noticeId,
	initialValues,
	onSuccess,
}: Props) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const isEdit = noticeId !== undefined;

	useEffect(() => {
		if (open) {
			setTitle(initialValues?.title ?? "");
			setBody(initialValues?.body ?? "");
		}
	}, [open, initialValues]);

	const handleSubmit = async () => {
		setIsLoading(true);
		try {
			if (isEdit) {
				await updateNotice(noticeId, { title, body });
			} else {
				await createNotice({ title, body });
			}
			onSuccess?.();
			onOpenChange(false);
		} catch (error) {
			console.error(error);
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
