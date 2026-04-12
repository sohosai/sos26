import { createProjectRegistrationForm } from "@/lib/api/committee-project-registration-form";
import { reportHandledError } from "@/lib/error/report";
import { normalizeItemConstraintsForType } from "@/lib/form/constraints";
import {
	ProjectRegistrationFormDialog,
	type ProjectRegistrationFormValues,
} from "./ProjectRegistrationFormDialog";

type FormPreview = {
	id: string;
	title: string;
	filterTypes: string[];
	filterLocations: string[];
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	activeForms?: FormPreview[];
	onSuccess?: () => void;
};

export function CreateProjectRegistrationFormDialog({
	open,
	onOpenChange,
	activeForms,
	onSuccess,
}: Props) {
	const handleSubmit = async (values: ProjectRegistrationFormValues) => {
		try {
			await createProjectRegistrationForm({
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
					constraints: normalizeItemConstraintsForType(
						item.type,
						item.constraints
					),
					options: item.options?.map((opt, i) => ({
						label: opt.label,
						sortOrder: i,
					})),
				})),
			});
		} catch (error) {
			reportHandledError({
				error,
				operation: "create",
				userMessage: "フォームの作成に失敗しました",
				ui: { type: "toast" },
				context: {
					formTitle: values.title.trim(),
				},
			});
			throw error;
		}
	};

	return (
		<ProjectRegistrationFormDialog
			open={open}
			onOpenChange={onOpenChange}
			dialogTitle="企画登録フォームを作成"
			submitLabel="作成"
			activeForms={activeForms}
			onSubmit={handleSubmit}
			onSuccess={onSuccess}
		/>
	);
}
