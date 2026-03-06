import { toast } from "sonner";
import { createProjectRegistrationForm } from "@/lib/api/committee-project-registration-form";
import {
	ProjectRegistrationFormDialog,
	type ProjectRegistrationFormValues,
} from "./ProjectRegistrationFormDialog";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
};

export function CreateProjectRegistrationFormDialog({
	open,
	onOpenChange,
	onSuccess,
}: Props) {
	const handleSubmit = async (values: ProjectRegistrationFormValues) => {
		try {
			await createProjectRegistrationForm({
				title: values.title.trim(),
				description: values.description.trim() || undefined,
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
			onSubmit={handleSubmit}
			onSuccess={onSuccess}
		/>
	);
}
