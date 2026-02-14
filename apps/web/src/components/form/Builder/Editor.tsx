import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Button, TextArea, TextField } from "@/components/primitives";
import type { Form, FormItem } from "../type";
import styles from "./Editor.module.scss";
import { FormItemList } from "./ItemList";

type Props = {
	initialForm: Form;
	onSubmit?: (form: Form) => void;
};

export function FormEditor({ initialForm, onSubmit }: Props) {
	const [formName, setFormName] = useState(initialForm.name);
	const [formDescription, setFormDescription] = useState(
		initialForm.description ?? ""
	);

	const [items, setItems] = useState<FormItem[]>(
		initialForm.items && initialForm.items.length > 0
			? initialForm.items
			: [
					{
						id: crypto.randomUUID(),
						label: "",
						type: "text",
						required: false,
					},
				]
	);

	const addItem = () => {
		setItems(prev => [
			...prev,
			{
				id: crypto.randomUUID(),
				label: "",
				type: "text",
				required: false,
			},
		]);
	};

	const updateItem = (id: string, update: Partial<FormItem>) => {
		setItems(prev =>
			prev.map(item => (item.id === id ? { ...item, ...update } : item))
		);
	};

	const removeItem = (id: string) => {
		setItems(prev => prev.filter(item => item.id !== id));
	};

	const handleSubmit = () => {
		const form: Form = {
			id: initialForm.id,
			name: formName.trim(),
			description: formDescription.trim() || undefined,
			items,
		};

		onSubmit?.(form);
	};

	return (
		<div className={styles.root}>
			<TextField
				label="フォーム名"
				value={formName}
				onChange={setFormName}
				placeholder="フォーム名を入力してください"
			/>
			<TextArea
				label="フォームの説明"
				placeholder="このフォームの目的や注意事項を記入してください"
				value={formDescription}
				onChange={setFormDescription}
				rows={3}
				resize="none"
				autoGrow
			/>
			<div className={styles.items}>
				<FormItemList
					items={items}
					setItems={setItems}
					onUpdate={updateItem}
					onRemove={removeItem}
				/>
			</div>

			<Button intent="secondary" onClick={addItem}>
				<IconPlus size={16} stroke={1.5} />
				項目を追加
			</Button>
			<Button onClick={handleSubmit}>保存</Button>
		</div>
	);
}
