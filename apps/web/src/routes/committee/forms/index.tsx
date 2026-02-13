import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FormEditDialog } from "@/components/form/Builder/EditDialog";
import type { Form } from "@/components/form/type";
import { Button } from "@/components/primitives/Button";
import { useAuthStore } from "@/lib/auth";

export const Route = createFileRoute("/committee/forms/")({
	component: CommitteeIndexPage,
	head: () => ({
		meta: [
			{ title: "申請管理 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "申請管理" },
		],
	}),
});

const mockForms: Form[] = [
	{
		id: "form-1",
		name: "企画参加申請フォーム",
		items: [],
	},
	{
		id: "form-2",
		name: "食品企画申請フォーム",
		items: [],
	},
];

function CommitteeIndexPage() {
	const { user } = useAuthStore();
	const [forms, setForms] = useState<Form[]>(mockForms);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingForm, setEditingForm] = useState<Form | null>(null);

	const handleCreate = () => {
		setEditingForm({
			id: crypto.randomUUID(),
			name: "",
			items: [],
		});
		setDialogOpen(true);
	};

	const handleEdit = (form: Form) => {
		setEditingForm(form);
		setDialogOpen(true);
	};

	const handleSubmit = (form: Form) => {
		setForms(prev => {
			const exists = prev.some(f => f.id === form.id);
			if (exists) {
				// update
				return prev.map(f => (f.id === form.id ? form : f));
			}
			// create
			return [...prev, form];
		});
		setDialogOpen(false);
	};

	return (
		<div style={{ padding: "2rem" }}>
			<Heading size="6">申請</Heading>
			<Text as="p" color="gray">
				ようこそ、{user?.name} さん
			</Text>
			{/* ここに申請を実装 */}
			{forms.map(form => (
				<div key={form.id} style={{ marginBottom: "1rem" }}>
					<Text size="2">{form.name}</Text>
					<Button onClick={() => handleEdit(form)}>編集</Button>
				</div>
			))}
			<Button onClick={handleCreate}>フォームを追加</Button>
			<FormEditDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				form={editingForm}
				onSubmit={handleSubmit}
			/>
		</div>
	);
}
