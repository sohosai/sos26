import { Dialog, VisuallyHidden } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { DiscardChangesDialog } from "@/components/patterns";
import type { Form } from "../type";
import styles from "./EditDialog.module.scss";
import { FormEditor } from "./Editor";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	form: Form | null;
	onSubmit?: (form: Form) => void;
	loading: boolean;
	children?: React.ReactNode;
};

export function FormEditDialog({
	open,
	onOpenChange,
	form,
	onSubmit,
	loading,
	children,
}: Props) {
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [isDirty, setIsDirty] = useState(false);

	useEffect(() => {
		if (!open) {
			setConfirmOpen(false);
			setIsDirty(false);
		}
	}, [open]);

	const handleOpenChange = (nextOpen: boolean) => {
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

	if (!form) return null;
	return (
		<Dialog.Root open={open} onOpenChange={handleOpenChange}>
			<Dialog.Content className={styles.dialogContent}>
				<VisuallyHidden>
					<Dialog.Title>申請編集</Dialog.Title>
				</VisuallyHidden>
				<div className={styles.dialogInner}>
					<FormEditor
						initialForm={form}
						onSubmit={onSubmit}
						loading={loading}
						onDirtyChange={setIsDirty}
					>
						{children}
					</FormEditor>
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
