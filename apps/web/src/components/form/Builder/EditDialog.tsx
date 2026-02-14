import { Dialog, VisuallyHidden } from "@radix-ui/themes";
import type { Form } from "../type";
import styles from "./EditDialog.module.scss";
import { FormEditor } from "./Editor";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	form: Form | null;
	onSubmit?: (form: Form) => void;
};

export function FormEditDialog({ open, onOpenChange, form, onSubmit }: Props) {
	if (!form) return null;
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content className={styles.dialogContent}>
				<VisuallyHidden>
					<Dialog.Title>Form Editor</Dialog.Title>
				</VisuallyHidden>
				<FormEditor initialForm={form} onSubmit={onSubmit} />
			</Dialog.Content>
		</Dialog.Root>
	);
}
