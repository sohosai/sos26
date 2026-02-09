// FormEditor.tsx
import { useState } from "react";
import type { Form, FormItem } from "../type";
import { FormItemList } from "./ItemList";

type Props = {
	initialForm: Form;
};

export function FormEditor({ initialForm }: Props) {
	const [formName, setFormName] = useState(initialForm.name);
	const [items, setItems] = useState<FormItem[]>(initialForm.items);

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

	return (
		<div>
			<input
				value={formName}
				onChange={e => setFormName(e.target.value)}
				placeholder="フォーム名"
			/>

			<FormItemList
				items={items}
				setItems={setItems}
				onUpdate={updateItem}
				onRemove={removeItem}
			/>

			<button type="button" onClick={addItem}>
				＋ 項目を追加
			</button>
		</div>
	);
}
