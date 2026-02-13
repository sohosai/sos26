import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FormAnswerDialog } from "@/components/form/Answer/AnswerDialog";
import { projectRegisterMockForm } from "@/components/form/projectInitFormMock";
import type { Form } from "@/components/form/type";
import { Button } from "@/components/primitives";
import { useAuthStore } from "@/lib/auth";

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

	return (
		<div style={{ padding: "2rem" }}>
			<Heading size="6">申請回答</Heading>
			<Text as="p" color="gray">
				ようこそ、{user?.name} さん
			</Text>

			<Button onClick={handleAnswer}>フォームに回答する</Button>

			<FormAnswerDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				form={answeringForm}
			/>
		</div>
	);
}
