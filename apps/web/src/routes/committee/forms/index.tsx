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

function CommitteeIndexPage() {
	const { user } = useAuthStore();
	const [_forms, _setForms] = useState<Form[]>([]);

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

	const _handleEdit = (form: Form) => {
		setEditingForm(form);
		setDialogOpen(true);
	};
	return (
		<div style={{ padding: "2rem" }}>
			<Heading size="6">申請</Heading>
			<Text as="p" color="gray">
				ようこそ、{user?.lastName} {user?.firstName} さん（{user?.role}）
			</Text>
			{/* ここに申請を実装 */}
			<Button onClick={handleCreate}>フォームを追加</Button>
			<FormEditDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				form={editingForm}
			/>
		</div>
	);
}
