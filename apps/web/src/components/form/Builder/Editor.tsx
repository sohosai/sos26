import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, TextArea, TextField } from "@/components/primitives";
import type { Form, FormItem } from "../type";
import styles from "./Editor.module.scss";
import { FormItemList } from "./ItemList";

type Props = {
	initialForm: Form;
	onSubmit?: (form: Form) => void;
	loading: boolean;
};

export function FormEditor({ initialForm, onSubmit, loading }: Props) {
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
		const invalidChoiceItem = items.find(item => {
			if (item.type === "checkbox" || item.type === "select") {
				if (!item.options || item.options.length === 0) return true;
				if (item.options.some(opt => opt.label.trim() === "")) return true;
			}
			return false;
		});

		if (invalidChoiceItem) {
			toast.error("選択式の項目には、空でない選択肢を1つ以上追加してください");
			return;
		}

		if (formName.trim() === "") {
			toast.error("フォーム名を入力してください");
			return;
		}

		const emptyLabelItem = items.find(item => item.label.trim() === "");

		if (emptyLabelItem) {
			toast.error("すべての設問に項目名を入力してください");
			return;
		}

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
			<Button onClick={handleSubmit} loading={loading}>
				保存
			</Button>
		</div>
	);
}
