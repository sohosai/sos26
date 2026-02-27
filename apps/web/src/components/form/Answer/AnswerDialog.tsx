import { Dialog, Spinner, VisuallyHidden } from "@radix-ui/themes";
import type { Form, FormAnswers } from "../type";
import styles from "./AnswerDialog.module.scss";
import { FormViewer } from "./FormViewer";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	form: Form | null;
	initialAnswers?: FormAnswers;
	onSubmit?: (answers: FormAnswers) => Promise<void>;
	onSaveDraft?: (answers: FormAnswers) => Promise<void>;
};

export function FormAnswerDialog({
	open,
	onOpenChange,
	form,
	initialAnswers,
	onSubmit,
	onSaveDraft,
}: Props) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content className={styles.dialogContent}>
				<VisuallyHidden>
					<Dialog.Title>Form Viewer</Dialog.Title>
				</VisuallyHidden>
				<div className={styles.dialogInner}>
					{form ? (
						<FormViewer
							form={form}
							initialAnswers={initialAnswers}
							onSubmit={onSubmit}
							onSaveDraft={onSaveDraft}
						/>
					) : (
						<div className={styles.loading}>
							<Spinner size="3" />
						</div>
					)}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
