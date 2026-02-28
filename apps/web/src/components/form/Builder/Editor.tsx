import { Text } from "@radix-ui/themes";
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
						type: "TEXT",
						required: false,
					},
				]
	);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const validate = (): boolean => {
		const newErrors: Record<string, string> = {};

		if (formName.trim() === "") {
			newErrors.__formName = "フォーム名を入力してください";
		}

		for (const item of items) {
			const error = validateItem(item);
			if (error) {
				newErrors[item.id] = error;
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	function validateItem(item: FormItem): string | null {
		if (item.label.trim() === "") {
			return "設問名を入力してください";
		}

		if (item.type === "SELECT" || item.type === "CHECKBOX") {
			if (!item.options || item.options.length === 0) {
				return "選択肢を1つ以上追加してください";
			}
			if (item.options.some(opt => opt.label.trim() === "")) {
				return "空の選択肢があります";
			}
		}

		return null;
	}

	const addItem = () => {
		setItems(prev => [
			...prev,
			{
				id: crypto.randomUUID(),
				label: "",
				type: "TEXT",
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
		if (!validate()) {
			toast.error("入力内容を確認してください");
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
			{errors.__formName && (
				<Text size="2" color="red">
					{errors.__formName}
				</Text>
			)}
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
					errors={errors}
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
