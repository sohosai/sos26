import { Dialog, Text, VisuallyHidden } from "@radix-ui/themes";
import type { ProjectLocation, ProjectType } from "@sos26/shared";
import { IconArrowsSort, IconPlus, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FormItemList } from "@/components/form/Builder/ItemList";
import type { FormItem } from "@/components/form/type";
import { DiscardChangesDialog } from "@/components/patterns";
import {
	Button,
	IconButton,
	TextArea,
	TextField,
} from "@/components/primitives";
import { ProjectCategorySelector } from "@/components/project/ProjectCategorySelector";
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
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [baselineValues, setBaselineValues] = useState(init);

	const initialValuesRef = useRef(initialValues);
	initialValuesRef.current = initialValues;
	const prevOpenRef = useRef(false);
	const forceCloseRef = useRef(false);

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
			setBaselineValues(v);
			setConfirmOpen(false);
		}
		prevOpenRef.current = open;
	}, [open]);

	const hasUnsavedChanges = useMemo(
		() =>
			title !== baselineValues.title ||
			description !== baselineValues.description ||
			sortOrder !== baselineValues.sortOrder ||
			JSON.stringify(filterTypes) !==
				JSON.stringify(baselineValues.filterTypes) ||
			JSON.stringify(filterLocations) !==
				JSON.stringify(baselineValues.filterLocations) ||
			JSON.stringify(items) !== JSON.stringify(baselineValues.items),
		[
			title,
			description,
			sortOrder,
			filterTypes,
			filterLocations,
			items,
			baselineValues,
		]
	);

	const requestClose = () => {
		if (isSubmitting) return;
		if (hasUnsavedChanges) {
			setConfirmOpen(true);
			return;
		}
		onOpenChange(false);
	};

	const closeWithoutConfirm = () => {
		forceCloseRef.current = true;
		setConfirmOpen(false);
		onOpenChange(false);
	};

	const handleCategoryChange = (next: {
		types: ProjectType[];
		locations: ProjectLocation[];
	}) => {
		setFilterTypes(next.types);
		setFilterLocations(next.locations);
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

		if (item.type === "FILE") {
			const minFiles = item.constraints?.minFiles;
			const maxFiles = item.constraints?.maxFiles;
			if (
				minFiles !== undefined &&
				maxFiles !== undefined &&
				minFiles > maxFiles
			) {
				return "最小ファイル数は最大ファイル数以下にしてください";
			}
		}

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
			<Dialog.Root
				open={open}
				onOpenChange={nextOpen => {
					if (nextOpen) {
						onOpenChange(true);
						return;
					}
					if (forceCloseRef.current) {
						forceCloseRef.current = false;
						return;
					}
					requestClose();
				}}
			>
				<Dialog.Content className={styles.dialogContent}>
					<VisuallyHidden>
						<Dialog.Title>{dialogTitle}</Dialog.Title>
					</VisuallyHidden>
					<div className={styles.dialogHeader}>
						<Text size="5" weight="bold">
							{dialogTitle}
						</Text>
						<IconButton aria-label="閉じる" onClick={requestClose}>
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

						<ProjectCategorySelector
							selectedTypes={filterTypes}
							selectedLocations={filterLocations}
							onChange={handleCategoryChange}
							typeLabel="対象企画区分（空=全区分）"
							locationLabel="対象実施場所（空=全場所）"
							fieldClassName={styles.field}
							checkboxGroupClassName={styles.checkboxGroup}
						/>

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
							onClick={requestClose}
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
			<DiscardChangesDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				onConfirm={closeWithoutConfirm}
			/>

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
