import { Dialog, VisuallyHidden } from "@radix-ui/themes";
import type { Form } from "../type";
import styles from "./EditDialog.module.scss";
import { FormEditor } from "./Editor";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	form: Form | null;
	onSubmit?: (form: Form) => void;
	loading: boolean;
};

export function FormEditDialog({
	open,
	onOpenChange,
	form,
	onSubmit,
	loading,
}: Props) {
	if (!form) return null;
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content className={styles.dialogContent}>
				<VisuallyHidden>
					<Dialog.Title>Form Editor</Dialog.Title>
				</VisuallyHidden>
				<div className={styles.dialogInner}>
					<FormEditor
						initialForm={form}
						onSubmit={onSubmit}
						loading={loading}
					/>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
