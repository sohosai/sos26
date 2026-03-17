import { Dialog, Spinner, VisuallyHidden } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { DiscardChangesDialog } from "@/components/patterns";
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
	disableSubmit?: boolean;
	disableSaveDraft?: boolean;
};

export function FormAnswerDialog({
	open,
	onOpenChange,
	form,
	initialAnswers,
	onSubmit,
	onSaveDraft,
	disableSubmit = false,
	disableSaveDraft = false,
}: Props) {
	const [isDirty, setIsDirty] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);

	useEffect(() => {
		if (!open) {
			setConfirmOpen(false);
			setIsDirty(false);
		}
	}, [open]);

	const handleDialogOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			onOpenChange(true);
			return;
		}

		if (isDirty) {
			setConfirmOpen(true);
			return;
		}

		onOpenChange(false);
	};

	const handleDiscard = () => {
		setConfirmOpen(false);
		setIsDirty(false);
		onOpenChange(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={handleDialogOpenChange}>
			<Dialog.Content className={styles.dialogContent}>
				<VisuallyHidden>
					<Dialog.Title>申請回答</Dialog.Title>
				</VisuallyHidden>
				<div className={styles.dialogInner}>
					{form ? (
						<FormViewer
							form={form}
							initialAnswers={initialAnswers}
							onSubmit={onSubmit}
							onSaveDraft={onSaveDraft}
							disableSubmit={disableSubmit}
							disableSaveDraft={disableSaveDraft}
							onDirtyChange={setIsDirty}
						/>
					) : (
						<div className={styles.loading}>
							<Spinner size="3" />
						</div>
					)}
				</div>
			</Dialog.Content>
			<DiscardChangesDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				onConfirm={handleDiscard}
			/>
		</Dialog.Root>
	);
}
