import { Dialog, VisuallyHidden } from "@radix-ui/themes";
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
			<Dialog.Title>
				<VisuallyHidden>Form Editor</VisuallyHidden>
			</Dialog.Title>
			<Dialog.Content className={styles.dialogContent}>
				<div className={styles.scrollArea}>
					<FormEditor initialForm={form} />
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
