import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FormAnswerDialog } from "@/components/form/Answer/AnswerDialog";
import {
	isCreateProjectFormAnswers,
	projectRegisterMockForm,
} from "@/components/form/projectInitFormMock";
import type { Form, FormAnswers } from "@/components/form/type";
import { Button } from "@/components/primitives";
import { createProject } from "@/lib/api/project";
import { useAuthStore } from "@/lib/auth";
import styles from "./index.module.scss";

export const Route = createFileRoute("/project/forms/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { user } = useAuthStore();

	const [dialogOpen, setDialogOpen] = useState(false);
	const [answeringForm, setAnsweringForm] = useState<Form | null>(null);

	const handleAnswer = () => {
		setAnsweringForm(projectRegisterMockForm);
		setDialogOpen(true);
	};

	const handleSubmit = async (answers: FormAnswers) => {
		if (!user) return;
		if (isCreateProjectFormAnswers(answers)) {
			try {
				await createProject(answers);
				setDialogOpen(false);
			} catch (e) {
				console.error(e);
			}
		} else {
			console.warn("企画作成フォームではありません。");
		}
	};

	return (
		<div className={styles.page}>
			<Heading size="6">申請回答</Heading>
			<Text as="p" color="gray">
				ようこそ、{user?.name} さん
			</Text>

			<Button onClick={handleAnswer}>企画を作成する</Button>

			<FormAnswerDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				form={answeringForm}
				onSubmit={handleSubmit}
			/>
		</div>
	);
}
