import type { Project } from "@sos26/shared";
import { FormAnswerDialog } from "@/components/form/Answer/AnswerDialog";
import {
	isCreateProjectFormAnswers,
	projectRegisterMockForm,
} from "@/components/form/projectInitFormMock";
import type { FormAnswers } from "@/components/form/type";
import { createProject } from "@/lib/api/project";
import { useAuthStore } from "@/lib/auth";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (project: Project) => void;
};

export function ProjectCreateDialog({ open, onOpenChange, onCreated }: Props) {
	const { user } = useAuthStore();

	const handleSubmit = async (answers: FormAnswers) => {
		if (!user) return;

		if (isCreateProjectFormAnswers(answers)) {
			try {
				const res = await createProject(answers);
				onCreated(res.project);
			} catch (e) {
				console.error(e);
			}
		} else {
			console.warn("企画作成フォームではありません。");
		}

		onOpenChange(false);
	};

	return (
		<FormAnswerDialog
			open={open}
			onOpenChange={onOpenChange}
			form={projectRegisterMockForm}
			onSubmit={handleSubmit}
		/>
	);
}
