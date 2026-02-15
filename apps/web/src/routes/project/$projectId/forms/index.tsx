import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FormAnswerDialog } from "@/components/form/Answer/AnswerDialog";
import { volunteerEntryFormMock } from "@/components/form/formMock";
import type { Form } from "@/components/form/type";
import { Button } from "@/components/primitives";
import { useAuthStore } from "@/lib/auth";
import styles from "./index.module.scss";

export const Route = createFileRoute("/project/$projectId/forms/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { user } = useAuthStore();

	const [dialogOpen, setDialogOpen] = useState(false);
	const [answeringForm, setAnsweringForm] = useState<Form | null>(null);

	const handleAnswer = () => {
		setAnsweringForm(volunteerEntryFormMock);
		setDialogOpen(true);
	};

	const handleSubmit = async () => {
		// todo:送信時の処理を書く
	};

	return (
		<div className={styles.page}>
			<Heading size="6">申請回答</Heading>
			<Text as="p" color="gray">
				ようこそ、{user?.name} さん
			</Text>

			<Button onClick={handleAnswer}>申請に回答する</Button>

			<FormAnswerDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				form={answeringForm}
				onSubmit={handleSubmit}
			/>
		</div>
	);
}
