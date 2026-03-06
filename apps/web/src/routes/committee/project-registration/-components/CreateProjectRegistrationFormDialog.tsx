import { toast } from "sonner";
import { createProjectRegistrationForm } from "@/lib/api/committee-project-registration-form";
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
				description: values.description.trim() || undefined,
				sortOrder: values.sortOrder,
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
			toast.error("フォームの作成に失敗しました");
			throw new Error();
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
