import { Dialog } from "@radix-ui/themes";
import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import {
	Button,
	IconButton,
	TextArea,
	TextField,
} from "@/components/primitives";
import styles from "./CreateNoticeDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function CreateNoticeDialog({ open, onOpenChange }: Props) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");

	const handleSubmit = () => {
		// TODO: API接続時に置き換え
		console.info({ title, body });
		setTitle("");
		setBody("");
		onOpenChange(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="540px">
				<div className={styles.dialogHeader}>
					<Dialog.Title mb="0">お知らせを作成</Dialog.Title>
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
					<TextArea
						label="本文"
						placeholder="お知らせの本文を入力"
						value={body}
						onChange={setBody}
						rows={6}
						autoGrow
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
							disabled={!title.trim() || !body.trim()}
						>
							作成
						</Button>
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
