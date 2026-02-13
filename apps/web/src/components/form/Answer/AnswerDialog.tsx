import { Dialog, VisuallyHidden } from "@radix-ui/themes";
import type { Form, FormAnswers } from "../type";
import styles from "./AnswerDialog.module.scss";
import { FormViewer } from "./FormViewer";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	form: Form | null;
	onSubmit?: (answers: FormAnswers) => void;
};

export function FormAnswerDialog({
	open,
	onOpenChange,
	form,
	onSubmit,
}: Props) {
	if (!form) return null;
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Title>
				<VisuallyHidden>Form Viewer</VisuallyHidden>
			</Dialog.Title>
			<Dialog.Content className={styles.dialogContent}>
				<div className={styles.scrollArea}>
					<FormViewer
						form={form}
						onSubmit={answers => {
							onSubmit?.(answers);
						}}
						onClose={() => onOpenChange(false)}
					/>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
