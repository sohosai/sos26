import { useEffect, useState } from "react";
import { FormEditDialog } from "@/components/form/Builder/EditDialog";
import type { Form } from "@/components/form/type";
import { updateFormDetail } from "@/lib/api/committee-form";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	formId: string;
	initialValues: Form;
	onSuccess?: () => Promise<void>;
};

export function EditFormDialog({
	open,
	onOpenChange,
	formId,
	initialValues,
	onSuccess,
}: Props) {
	const [form, setForm] = useState<Form>(initialValues);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// ダイアログを開いたタイミングで初期値にリセット
	useEffect(() => {
		if (open) {
			setForm(initialValues);
		}
	}, [open, initialValues]);

	const handleSubmit = async (submitted: Form) => {
		setIsSubmitting(true);
		try {
			await updateFormDetail(formId, {
				title: submitted.name,
				description: submitted.description,
				items: submitted.items.map((item, index) => ({
					id: item.id || undefined, // 既存itemはidを送る、新規は省略
					label: item.label,
					description: item.description ?? null,
					type: item.type,
					required: item.required,
					sortOrder: index,
					options: item.options?.map((opt, i) => ({
						label: opt.label,
						sortOrder: i,
					})),
				})),
			});

			await onSuccess?.();
			onOpenChange(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<FormEditDialog
			open={open}
			onOpenChange={onOpenChange}
			form={form}
			onSubmit={handleSubmit}
			loading={isSubmitting}
		/>
	);
}
