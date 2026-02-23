import { useEffect, useState } from "react";
import { FormEditDialog } from "@/components/form/Builder/EditDialog";
import type { Form } from "@/components/form/type";
import { createForm } from "@/lib/api/committee-form";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
};

const EMPTY_FORM: Form = {
	id: "",
	name: "",
	description: undefined,
	items: [],
};

export function CreateFormDialog({ open, onOpenChange, onSuccess }: Props) {
	const [form, setForm] = useState<Form>(EMPTY_FORM);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// ダイアログを開いたタイミングで初期化
	useEffect(() => {
		if (open) {
			setForm(EMPTY_FORM);
		}
	}, [open]);

	const handleSubmit = async (form: Form) => {
		setIsSubmitting(true);
		try {
			await createForm({
				title: form.name,
				description: form.description,
				items: form.items.map((item, index) => ({
					label: item.label,
					type: item.type.toUpperCase() as Uppercase<typeof item.type>,
					required: item.required,
					sortOrder: index,
					options: item.options?.map((opt, i) => ({
						label: opt.label,
						sortOrder: i,
					})),
				})),
			});

			onSuccess?.();
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
