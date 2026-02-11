import { useState } from "react";
import type { Form, FormItem } from "../type";
import styles from "./Editor.module.scss";
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
		<div className={styles.root}>
			<input
				className={styles.titleInput}
				value={formName}
				onChange={e => setFormName(e.target.value)}
				placeholder="フォーム名"
			/>
			<div className={styles.items}>
				<FormItemList
					items={items}
					setItems={setItems}
					onUpdate={updateItem}
					onRemove={removeItem}
				/>
			</div>

			<button className={styles.addButton} type="button" onClick={addItem}>
				＋ 項目を追加
			</button>
		</div>
	);
}
