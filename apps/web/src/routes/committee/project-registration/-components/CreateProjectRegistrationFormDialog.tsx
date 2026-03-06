import { Dialog, Text, VisuallyHidden } from "@radix-ui/themes";
import type { ProjectLocation, ProjectType } from "@sos26/shared";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormItemList } from "@/components/form/Builder/ItemList";
import type { FormItem } from "@/components/form/type";
import {
	Button,
	Checkbox,
	IconButton,
	TextArea,
	TextField,
} from "@/components/primitives";
import { createProjectRegistrationForm } from "@/lib/api/committee-project-registration-form";
import styles from "./CreateProjectRegistrationFormDialog.module.scss";

const TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
	{ value: "NORMAL", label: "通常企画" },
	{ value: "FOOD", label: "食品企画" },
	{ value: "STAGE", label: "ステージ企画" },
];

const LOCATION_OPTIONS: { value: ProjectLocation; label: string }[] = [
	{ value: "INDOOR", label: "屋内" },
	{ value: "OUTDOOR", label: "屋外" },
	{ value: "STAGE", label: "ステージ" },
];

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
};

export function CreateProjectRegistrationFormDialog({
	open,
	onOpenChange,
	onSuccess,
}: Props) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [sortOrder, setSortOrder] = useState("0");
	const [filterTypes, setFilterTypes] = useState<ProjectType[]>([]);
	const [filterLocations, setFilterLocations] = useState<ProjectLocation[]>([]);
	const [items, setItems] = useState<FormItem[]>([
		{ id: crypto.randomUUID(), label: "", type: "TEXT", required: false },
	]);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (open) {
			setTitle("");
			setDescription("");
			setSortOrder("0");
			setFilterTypes([]);
			setFilterLocations([]);
			setItems([
				{ id: crypto.randomUUID(), label: "", type: "TEXT", required: false },
			]);
			setErrors({});
		}
	}, [open]);

	const toggleType = (value: ProjectType) => {
		setFilterTypes(prev =>
			prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
		);
	};

	const toggleLocation = (value: ProjectLocation) => {
		setFilterLocations(prev =>
			prev.includes(value) ? prev.filter(l => l !== value) : [...prev, value]
		);
	};

	const addItem = () => {
		setItems(prev => [
			...prev,
			{ id: crypto.randomUUID(), label: "", type: "TEXT", required: false },
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

	const validateItemLabel = (item: FormItem): string | null => {
		if (!item.label.trim()) return "設問名を入力してください";
		return null;
	};

	const validateItemOptions = (item: FormItem): string | null => {
		if (
			(item.type === "SELECT" || item.type === "CHECKBOX") &&
			(!item.options || item.options.length === 0)
		) {
			return "選択肢を1つ以上追加してください";
		}
		if (item.options?.some(o => !o.label.trim())) {
			return "空の選択肢があります";
		}
		return null;
	};

	const validateItem = (item: FormItem): string | null => {
		return validateItemLabel(item) || validateItemOptions(item);
	};

	const validate = (): boolean => {
		const newErrors: Record<string, string> = {};
		if (!title.trim()) newErrors.__title = "フォームタイトルを入力してください";
		if (items.length === 0) newErrors.__items = "項目を1つ以上追加してください";
		for (const item of items) {
			const itemError = validateItem(item);
			if (itemError) newErrors[item.id] = itemError;
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async () => {
		if (!validate()) {
			toast.error("入力内容を確認してください");
			return;
		}
		setIsSubmitting(true);
		try {
			await createProjectRegistrationForm({
				title: title.trim(),
				description: description.trim() || undefined,
				sortOrder: Number(sortOrder) || 0,
				filterTypes,
				filterLocations,
				items: items.map((item, index) => ({
					label: item.label,
					description: item.description,
					type: item.type,
					required: item.required,
					sortOrder: index,
					options: item.options?.map((opt, i) => ({
						label: opt.label,
						sortOrder: i,
					})),
				})),
			});
			onSuccess?.();
			onOpenChange(false);
		} catch {
			toast.error("フォームの作成に失敗しました");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content className={styles.dialogContent}>
				<VisuallyHidden>
					<Dialog.Title>企画登録フォームを作成</Dialog.Title>
				</VisuallyHidden>
				<div className={styles.dialogHeader}>
					<Text size="5" weight="bold">
						企画登録フォームを作成
					</Text>
					<IconButton aria-label="閉じる" onClick={() => onOpenChange(false)}>
						<IconX size={16} />
					</IconButton>
				</div>
				<div className={styles.dialogInner}>
					<div className={styles.field}>
						<TextField
							label="フォームタイトル *"
							value={title}
							onChange={setTitle}
							placeholder="例：屋外企画向け追加情報"
						/>
						{errors.__title && (
							<Text size="1" color="red">
								{errors.__title}
							</Text>
						)}
					</div>

					<div className={styles.field}>
						<TextArea
							label="説明（任意）"
							value={description}
							onChange={setDescription}
							placeholder="フォームの説明や注意事項"
							rows={2}
							resize="none"
							autoGrow
						/>
					</div>

					<div className={styles.field}>
						<Text as="label" size="2" weight="medium">
							対象企画区分（空=全区分）
						</Text>
						<div className={styles.checkboxGroup}>
							{TYPE_OPTIONS.map(opt => (
								<Checkbox
									key={opt.value}
									label={opt.label}
									checked={filterTypes.includes(opt.value)}
									onCheckedChange={() => toggleType(opt.value)}
								/>
							))}
						</div>
					</div>

					<div className={styles.field}>
						<Text as="label" size="2" weight="medium">
							対象実施場所（空=全場所）
						</Text>
						<div className={styles.checkboxGroup}>
							{LOCATION_OPTIONS.map(opt => (
								<Checkbox
									key={opt.value}
									label={opt.label}
									checked={filterLocations.includes(opt.value)}
									onCheckedChange={() => toggleLocation(opt.value)}
								/>
							))}
						</div>
					</div>

					<div className={styles.field}>
						<TextField
							label="表示順"
							type="number"
							value={sortOrder}
							onChange={setSortOrder}
						/>
					</div>

					<div className={styles.itemsSection}>
						<Text size="2" weight="medium">
							フォーム項目
						</Text>
						<FormItemList
							items={items}
							errors={errors}
							setItems={setItems}
							onUpdate={updateItem}
							onRemove={removeItem}
						/>
						{errors.__items && (
							<Text size="1" color="red">
								{errors.__items}
							</Text>
						)}
						<Button intent="secondary" onClick={addItem} size="2">
							<IconPlus size={16} stroke={1.5} />
							項目を追加
						</Button>
					</div>
				</div>

				<div className={styles.dialogFooter}>
					<Button
						intent="secondary"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						キャンセル
					</Button>
					<Button onClick={handleSubmit} loading={isSubmitting}>
						作成
					</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
