import type { ProjectRegistrationFormDetail } from "@sos26/shared";
import { toast } from "sonner";
import { updateProjectRegistrationForm } from "@/lib/api/committee-project-registration-form";
import {
	ProjectRegistrationFormDialog,
	type ProjectRegistrationFormValues,
} from "../../-components/ProjectRegistrationFormDialog";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	formId: string;
	initialForm: ProjectRegistrationFormDetail;
	onSuccess?: () => void;
};

function toFormValues(
	form: ProjectRegistrationFormDetail
): ProjectRegistrationFormValues {
	return {
		title: form.title,
		description: form.description ?? "",
		sortOrder: String(form.sortOrder),
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
	onSuccess,
}: Props) {
	const handleSubmit = async (values: ProjectRegistrationFormValues) => {
		try {
			await updateProjectRegistrationForm(formId, {
				title: values.title.trim(),
				description: values.description.trim() || null,
				sortOrder: Number(values.sortOrder) || 0,
				filterTypes: values.filterTypes,
				filterLocations: values.filterLocations,
				items: values.items.map((item, index) => ({
					label: item.label,
					description: item.description,
					type: item.type,
					required: item.required,
					sortOrder: index,
					options: item.options?.map((opt, i) => ({
						label: opt.label,
						sortOrder: i,
					})),
				})),
			});
		} catch {
			toast.error("フォームの更新に失敗しました");
			throw new Error();
		}
	};

	return (
		<ProjectRegistrationFormDialog
			open={open}
			onOpenChange={onOpenChange}
			dialogTitle="企画登録フォームを編集"
			submitLabel="保存"
			initialValues={toFormValues(initialForm)}
			onSubmit={handleSubmit}
			onSuccess={onSuccess}
		/>
	);
}
