import { Dialog } from "@radix-ui/themes";
import type { Form } from "../type";
import styles from "./EditDialog.module.scss";
import { FormEditor } from "./Editor";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	form: Form | null;
};

export function FormEditDialog({ open, onOpenChange, form }: Props) {
	if (!form) return null;
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content className={styles.dialogContent}>
				<Dialog.Title>フォーム編集</Dialog.Title>
				<FormEditor initialForm={form} />
			</Dialog.Content>
		</Dialog.Root>
	);
}
