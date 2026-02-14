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
			<Dialog.Content className={styles.dialogContent}>
				<VisuallyHidden>
					<Dialog.Title>Form Viewer</Dialog.Title>
				</VisuallyHidden>
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
