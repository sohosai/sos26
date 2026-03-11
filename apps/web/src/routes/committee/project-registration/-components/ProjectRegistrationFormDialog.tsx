import { Dialog, Text, VisuallyHidden } from "@radix-ui/themes";
import type { ProjectLocation, ProjectType } from "@sos26/shared";
import { IconArrowsSort, IconPlus, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
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
import {
	PROJECT_LOCATION_OPTIONS,
	PROJECT_TYPE_OPTIONS,
} from "@/lib/project/options";
import styles from "./ProjectRegistrationFormDialog.module.scss";
import { ReorderFormsDialog } from "./ReorderFormsDialog";

export type ProjectRegistrationFormValues = {
	title: string;
	description: string;
	sortOrder: number;
	filterTypes: ProjectType[];
	filterLocations: ProjectLocation[];
	items: FormItem[];
};

type FormPreview = {
	id: string;
	title: string;
	filterTypes: string[];
	filterLocations: string[];
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	dialogTitle: string;
	submitLabel: string;
	initialValues?: ProjectRegistrationFormValues;
	activeForms?: FormPreview[];
	onSubmit: (values: ProjectRegistrationFormValues) => Promise<void>;
	onSuccess?: () => void;
};

function makeDefaultValues(): ProjectRegistrationFormValues {
	return {
		title: "",
		description: "",
		sortOrder: 0,
		filterTypes: [],
		filterLocations: [],
		items: [
			{ id: crypto.randomUUID(), label: "", type: "TEXT", required: false },
		],
	};
}

export function ProjectRegistrationFormDialog({
	open,
	onOpenChange,
	dialogTitle,
	submitLabel,
	initialValues,
	activeForms,
	onSubmit,
	onSuccess,
}: Props) {
	const init = initialValues ?? makeDefaultValues();
	const [title, setTitle] = useState(init.title);
	const [description, setDescription] = useState(init.description);
	const [sortOrder, setSortOrder] = useState(init.sortOrder);
	const [filterTypes, setFilterTypes] = useState<ProjectType[]>(
		init.filterTypes
	);
	const [filterLocations, setFilterLocations] = useState<ProjectLocation[]>(
		init.filterLocations
	);
	const [items, setItems] = useState<FormItem[]>(init.items);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [pickerOpen, setPickerOpen] = useState(false);

	const initialValuesRef = useRef(initialValues);
	initialValuesRef.current = initialValues;
	const prevOpenRef = useRef(false);

	useEffect(() => {
		if (open && !prevOpenRef.current) {
			const v = initialValuesRef.current ?? makeDefaultValues();
			setTitle(v.title);
			setDescription(v.description);
			setSortOrder(v.sortOrder);
			setFilterTypes(v.filterTypes);
			setFilterLocations(v.filterLocations);
			setItems(v.items);
			setErrors({});
		}
		prevOpenRef.current = open;
	}, [open]);

	// タイプと場所の選択ロジック
	const handleStageTypeToggle = () => {
		if (!filterTypes.includes("STAGE")) {
			setFilterTypes(["STAGE"]);
			setFilterLocations(["STAGE"]);
		} else {
			setFilterTypes(prev => prev.filter(t => t !== "STAGE"));
			setFilterLocations(prev => prev.filter(l => l !== "STAGE"));
		}
	};

	const handleNormalTypeToggle = (value: ProjectType) => {
		if (filterTypes.includes("STAGE")) {
			setFilterTypes([value]);
			setFilterLocations(prev => prev.filter(l => l !== "STAGE"));
		} else {
			const newTypes = filterTypes.includes(value)
				? filterTypes.filter(t => t !== value)
				: [...filterTypes, value];
			setFilterTypes(newTypes);
			if (newTypes.length > 0 && !newTypes.includes("STAGE")) {
				setFilterLocations(prev => prev.filter(l => l !== "STAGE"));
			}
		}
	};

	const toggleType = (value: ProjectType) => {
		if (value === "STAGE") {
			handleStageTypeToggle();
		} else {
			handleNormalTypeToggle(value);
		}
	};

	const toggleLocation = (value: ProjectLocation) => {
		setFilterLocations(prev =>
			prev.includes(value) ? prev.filter(l => l !== value) : [...prev, value]
		);
	};

	const addItem = () => {
		setItems(prev => [
			...prev,
			{
				id: crypto.randomUUID(),
				label: "",
				type: "TEXT" as const,
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

	const validateItemLabel = (item: FormItem): string | null => {
		if (!item.label.trim()) {
			return "設問名を入力してください";
		}
		return null;
	};

	const validateItemOptions = (item: FormItem): string | null => {
		const needsOptions = item.type === "SELECT" || item.type === "CHECKBOX";
		if (needsOptions && (!item.options || item.options.length === 0)) {
			return "選択肢を1つ以上追加してください";
		}
		if (item.options?.some(o => !o.label.trim())) {
			return "空の選択肢があります";
		}
		return null;
	};

	const validateItem = (item: FormItem): string | null => {
		const labelError = validateItemLabel(item);
		if (labelError) return labelError;
		return validateItemOptions(item);
	};

	const validate = (): boolean => {
		const newErrors: Record<string, string> = {};
		if (!title.trim()) newErrors.__title = "フォームタイトルを入力してください";
		if (items.length === 0) newErrors.__items = "項目を1つ以上追加してください";
		for (const item of items) {
			const error = validateItem(item);
			if (error) {
				newErrors[item.id] = error;
			}
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
			await onSubmit({
				title,
				description,
				sortOrder,
				filterTypes,
				filterLocations,
				items,
			});
			onSuccess?.();
			onOpenChange(false);
		} catch {
			// エラーメッセージは呼び出し元で制御
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<Dialog.Root open={open} onOpenChange={onOpenChange}>
				<Dialog.Content className={styles.dialogContent}>
					<VisuallyHidden>
						<Dialog.Title>{dialogTitle}</Dialog.Title>
					</VisuallyHidden>
					<div className={styles.dialogHeader}>
						<Text size="5" weight="bold">
							{dialogTitle}
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
								表示順
							</Text>
							<div className={styles.sortOrderRow}>
								<TextField
									label=""
									type="number"
									value={String(sortOrder)}
									onChange={v => setSortOrder(Math.max(0, Number(v) || 0))}
									placeholder="0"
								/>
								{activeForms && (
									<IconButton
										aria-label="表示位置をプレビューで選択"
										onClick={() => setPickerOpen(true)}
									>
										<IconArrowsSort size={16} />
									</IconButton>
								)}
							</div>
						</div>

						<div className={styles.field}>
							<Text as="label" size="2" weight="medium">
								対象企画区分（空=全区分）
							</Text>
							<div className={styles.checkboxGroup}>
								{PROJECT_TYPE_OPTIONS.map(opt => (
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
								{PROJECT_LOCATION_OPTIONS.map(opt => {
									const isStageOpt = opt.value === "STAGE";
									const stageTypeSelected = filterTypes.includes("STAGE");
									const nonStageTypeSelected = filterTypes.some(
										t => t !== "STAGE"
									);
									const disabled = isStageOpt
										? filterTypes.length > 0 && !stageTypeSelected
										: stageTypeSelected && !nonStageTypeSelected;
									return (
										<Checkbox
											key={opt.value}
											label={opt.label}
											checked={filterLocations.includes(opt.value)}
											onCheckedChange={() =>
												!disabled && toggleLocation(opt.value)
											}
											disabled={disabled}
										/>
									);
								})}
							</div>
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
							{submitLabel}
						</Button>
					</div>
				</Dialog.Content>
			</Dialog.Root>

			{activeForms && (
				<ReorderFormsDialog
					open={pickerOpen}
					onOpenChange={setPickerOpen}
					activeForms={activeForms}
					newFormTitle={title}
					initialSortOrder={sortOrder}
					onConfirm={setSortOrder}
				/>
			)}
		</>
	);
}
