import type { ProjectRegistrationFormDetail } from "@sos26/shared";
import { useMemo } from "react";
import { updateProjectRegistrationForm } from "@/lib/api/committee-project-registration-form";
import { reportHandledError } from "@/lib/error/report";
import {
	ProjectRegistrationFormDialog,
	type ProjectRegistrationFormValues,
} from "../../-components/ProjectRegistrationFormDialog";

type FormPreview = {
	id: string;
	title: string;
	filterTypes: string[];
	filterLocations: string[];
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	formId: string;
	initialForm: ProjectRegistrationFormDetail;
	activeForms?: FormPreview[];
	onSuccess?: () => void;
};

function toFormValues(
	form: ProjectRegistrationFormDetail
): ProjectRegistrationFormValues {
	return {
		title: form.title,
		description: form.description ?? "",
		sortOrder: form.sortOrder,
		filterTypes: form.filterTypes,
		filterLocations: form.filterLocations,
		items: [...form.items]
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(item => ({
				id: item.id,
				label: item.label,
				description: item.description ?? undefined,
				type: item.type,
				required: item.required,
				constraints: item.constraints,
				options: [...item.options]
					.sort((a, b) => a.sortOrder - b.sortOrder)
					.map(opt => ({ id: opt.id, label: opt.label })),
			})),
	};
}

export function EditProjectRegistrationFormDialog({
	open,
	onOpenChange,
	formId,
	initialForm,
	activeForms,
	onSuccess,
}: Props) {
	const handleSubmit = async (values: ProjectRegistrationFormValues) => {
		try {
			await updateProjectRegistrationForm(formId, {
				title: values.title.trim(),
				description: values.description.trim() || null,
				sortOrder: values.sortOrder,
				filterTypes: values.filterTypes,
				filterLocations: values.filterLocations,
				items: values.items.map((item, index) => ({
					label: item.label,
					description: item.description,
					type: item.type,
					required: item.required,
					sortOrder: index,
					constraints: item.constraints,
					options: item.options?.map((opt, i) => ({
						label: opt.label,
						sortOrder: i,
					})),
				})),
			});
		} catch (error) {
			reportHandledError({
				error,
				operation: "save",
				userMessage: "フォームの更新に失敗しました",
				ui: { type: "toast" },
				context: {
					formId,
					formTitle: values.title.trim(),
				},
			});
			throw error;
		}
	};

	const initialValues = useMemo(() => toFormValues(initialForm), [initialForm]);

	return (
		<ProjectRegistrationFormDialog
			open={open}
			onOpenChange={onOpenChange}
			dialogTitle="企画登録フォームを編集"
			submitLabel="保存"
			initialValues={initialValues}
			activeForms={activeForms}
			onSubmit={handleSubmit}
			onSuccess={onSuccess}
		/>
	);
}
