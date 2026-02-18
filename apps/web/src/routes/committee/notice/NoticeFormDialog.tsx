import { Dialog } from "@radix-ui/themes";
import { IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { RichTextEditor } from "@/components/patterns";
import { Button, IconButton, TextField } from "@/components/primitives";
import { createNotice, updateNotice } from "@/lib/api/committee-notice";
import styles from "./NoticeFormDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	notice?: { id: string; title: string; body: string };
	onSuccess: () => void;
};

export function NoticeFormDialog({
	open,
	onOpenChange,
	notice,
	onSuccess,
}: Props) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const isEdit = !!notice;

	useEffect(() => {
		if (open) {
			setTitle(notice?.title ?? "");
			setBody(notice?.body ?? "");
		}
	}, [open, notice]);

	const handleSubmit = async () => {
		setSubmitting(true);
		try {
			if (isEdit) {
				await updateNotice(notice.id, { title, body });
			} else {
				await createNotice({ title, body });
			}
			setTitle("");
			setBody("");
			onOpenChange(false);
			onSuccess();
		} catch (err) {
			console.error(err);
			alert(
				isEdit ? "お知らせの更新に失敗しました" : "お知らせの作成に失敗しました"
			);
		} finally {
			setSubmitting(false);
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
						>
							キャンセル
						</Button>
						<Button
							intent="primary"
							size="2"
							onClick={handleSubmit}
							disabled={
								submitting ||
								!title.trim() ||
								!body.replace(/<[^>]*>/g, "").trim()
							}
						>
							{isEdit ? "保存" : "作成"}
						</Button>
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
