import {
	Badge,
	Box,
	Dialog,
	Flex,
	TextField as RadixTextField,
	Tabs,
	Text,
} from "@radix-ui/themes";
import type {
	FormItem,
	GetMastersheetDataResponse,
	ListMyFormsResponse,
	MastersheetColumnVisibility,
	MastersheetDataType,
} from "@sos26/shared";
import { IconEdit, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, IconButton, Select, TextField } from "@/components/primitives";
import { getFormDetail, listMyForms } from "@/lib/api/committee-form";
import {
	createMastersheetColumn,
	deleteMastersheetColumn,
	updateMastersheetColumn,
} from "@/lib/api/committee-mastersheet";
import { isClientError } from "@/lib/http/error";
import styles from "./ColumnManagerDialog.module.scss";

// ─────────────────────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────────────────────

const DATA_TYPE_OPTIONS = [
	{ value: "TEXT", label: "テキスト" },
	{ value: "NUMBER", label: "数値" },
	{ value: "SELECT", label: "単一選択" },
	{ value: "MULTI_SELECT", label: "複数選択" },
];

const COLUMN_TYPE_OPTIONS = [
	{ value: "CUSTOM", label: "カスタムカラム" },
	{ value: "FORM_ITEM", label: "フォーム項目カラム" },
];

const VISIBILITY_OPTIONS = [
	{ value: "PRIVATE", label: "非公開（自分のみ）" },
	{ value: "PUBLIC", label: "公開（全委員）" },
];

const DATA_TYPE_LABEL: Record<string, string> = {
	TEXT: "テキスト",
	NUMBER: "数値",
	SELECT: "単一選択",
	MULTI_SELECT: "複数選択",
};

type ApiColumn = GetMastersheetDataResponse["columns"][number];

// ─────────────────────────────────────────────────────────────
// 選択肢行
// ─────────────────────────────────────────────────────────────

type OptionRowProps = {
	value: string;
	onChange: (value: string) => void;
	onRemove: () => void;
};

function OptionRow({ value, onChange, onRemove }: OptionRowProps) {
	return (
		<div className={styles.optionRow}>
			<div className={styles.optionInput}>
				<RadixTextField.Root
					size="2"
					value={value}
					placeholder="選択肢のラベル"
					onChange={e => onChange(e.target.value)}
				/>
			</div>
			<IconButton aria-label="この選択肢を削除" size="1" onClick={onRemove}>
				<IconX size={14} />
			</IconButton>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// カラム編集フォーム（インライン）
// ─────────────────────────────────────────────────────────────

type EditColumnFormProps = {
	col: ApiColumn;
	onSuccess: () => void;
	onCancel: () => void;
};

function EditColumnForm({ col, onSuccess, onCancel }: EditColumnFormProps) {
	const [name, setName] = useState(col.name);
	const [description, setDescription] = useState(col.description ?? "");
	const [visibility, setVisibility] = useState<string>(
		col.visibility ?? "PRIVATE"
	);
	const [loading, setLoading] = useState(false);

	async function handleSubmit() {
		if (!name.trim()) {
			toast.error("カラム名を入力してください");
			return;
		}
		setLoading(true);
		try {
			await updateMastersheetColumn(col.id, {
				name: name.trim(),
				description: description.trim() || null,
				visibility:
					col.type === "CUSTOM"
						? (visibility as MastersheetColumnVisibility)
						: undefined,
			});
			toast.success("カラムを更新しました");
			onSuccess();
		} catch (error) {
			toast.error(isClientError(error) ? error.message : "更新に失敗しました");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className={styles.editForm}>
			<TextField label="カラム名" value={name} onChange={setName} required />
			<TextField label="説明" value={description} onChange={setDescription} />
			{col.type === "CUSTOM" && (
				<div className={styles.field}>
					<Text as="label" size="2" weight="medium">
						公開設定
					</Text>
					<Select
						options={VISIBILITY_OPTIONS}
						value={visibility}
						onValueChange={setVisibility}
					/>
				</div>
			)}
			<div className={styles.actions}>
				<Button intent="secondary" size="2" onClick={onCancel}>
					キャンセル
				</Button>
				<Button
					intent="primary"
					size="2"
					loading={loading}
					onClick={handleSubmit}
				>
					保存
				</Button>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// カラムリストアイテム アクション
// ─────────────────────────────────────────────────────────────

type ColumnListItemActionsProps = {
	confirmingDelete: boolean;
	deleteLoading: boolean;
	onEdit: () => void;
	onDeleteConfirm: () => void;
	onDeleteExecute: () => void;
	onDeleteCancel: () => void;
};

function ColumnListItemActions({
	confirmingDelete,
	deleteLoading,
	onEdit,
	onDeleteConfirm,
	onDeleteExecute,
	onDeleteCancel,
}: ColumnListItemActionsProps) {
	if (confirmingDelete) {
		return (
			<div className={styles.confirmDelete}>
				<Text size="2">削除しますか？</Text>
				<Button
					intent="danger"
					size="1"
					loading={deleteLoading}
					onClick={onDeleteExecute}
				>
					削除
				</Button>
				<Button intent="secondary" size="1" onClick={onDeleteCancel}>
					キャンセル
				</Button>
			</div>
		);
	}
	return (
		<div className={styles.listItemActions}>
			<IconButton aria-label="編集" onClick={onEdit}>
				<IconEdit size={14} />
			</IconButton>
			<IconButton aria-label="削除" intent="danger" onClick={onDeleteConfirm}>
				<IconTrash size={14} />
			</IconButton>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// カラムリストアイテム
// ─────────────────────────────────────────────────────────────

type ColumnListItemProps = {
	col: ApiColumn;
	onSuccess: () => void;
};

function ColumnListItem({ col, onSuccess }: ColumnListItemProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);

	async function handleDelete() {
		setDeleteLoading(true);
		try {
			await deleteMastersheetColumn(col.id);
			toast.success("カラムを削除しました");
			onSuccess();
		} catch (error) {
			toast.error(isClientError(error) ? error.message : "削除に失敗しました");
		} finally {
			setDeleteLoading(false);
		}
	}

	return (
		<div>
			<div className={styles.listItem}>
				<div className={styles.listItemInfo}>
					<Flex align="center" gap="2">
						<Text size="2" weight="medium" truncate>
							{col.name}
						</Text>
						<Badge size="1" color={col.type === "FORM_ITEM" ? "blue" : "gray"}>
							{col.type === "FORM_ITEM"
								? "フォーム"
								: (DATA_TYPE_LABEL[col.dataType ?? ""] ?? "カスタム")}
						</Badge>
					</Flex>
					{col.description && (
						<Text size="1" color="gray" truncate>
							{col.description}
						</Text>
					)}
				</div>
				{col.isOwner && (
					<ColumnListItemActions
						confirmingDelete={confirmingDelete}
						deleteLoading={deleteLoading}
						onEdit={() => setIsEditing(prev => !prev)}
						onDeleteConfirm={() => setConfirmingDelete(true)}
						onDeleteExecute={handleDelete}
						onDeleteCancel={() => setConfirmingDelete(false)}
					/>
				)}
			</div>
			{isEditing && (
				<EditColumnForm
					col={col}
					onSuccess={() => {
						setIsEditing(false);
						onSuccess();
					}}
					onCancel={() => setIsEditing(false)}
				/>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// CUSTOMカラム追加フォーム
// ─────────────────────────────────────────────────────────────

type CreateCustomFormProps = {
	columns: ApiColumn[];
	onSuccess: () => void;
	onCancel: () => void;
};

type OptionEntry = { id: number; label: string };

function CreateCustomForm({
	columns,
	onSuccess,
	onCancel,
}: CreateCustomFormProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [dataType, setDataType] = useState("TEXT");
	const [visibility, setVisibility] = useState("PRIVATE");
	const [options, setOptions] = useState<OptionEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const nextId = useRef(0);

	const showOptions = dataType === "SELECT" || dataType === "MULTI_SELECT";

	function addOption() {
		setOptions(prev => [...prev, { id: nextId.current++, label: "" }]);
	}

	function removeOption(id: number) {
		setOptions(prev => prev.filter(o => o.id !== id));
	}

	function updateOption(id: number, value: string) {
		setOptions(prev =>
			prev.map(o => (o.id === id ? { ...o, label: value } : o))
		);
	}

	async function handleSubmit() {
		if (!name.trim()) {
			toast.error("カラム名を入力してください");
			return;
		}
		setLoading(true);
		try {
			const optionsInput = showOptions
				? options
						.filter(o => o.label.trim())
						.map((o, i) => ({ label: o.label, sortOrder: i }))
				: undefined;
			await createMastersheetColumn({
				type: "CUSTOM",
				name: name.trim(),
				description: description.trim() || undefined,
				sortOrder: columns.length,
				dataType: dataType as MastersheetDataType,
				visibility: visibility as MastersheetColumnVisibility,
				options: optionsInput,
			});
			toast.success("カラムを追加しました");
			onSuccess();
		} catch (error) {
			toast.error(isClientError(error) ? error.message : "追加に失敗しました");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className={styles.form}>
			<TextField label="カラム名" value={name} onChange={setName} required />
			<div className={styles.field}>
				<Text as="label" size="2" weight="medium">
					データ型 *
				</Text>
				<Select
					options={DATA_TYPE_OPTIONS}
					value={dataType}
					onValueChange={setDataType}
				/>
			</div>
			<div className={styles.field}>
				<Text as="label" size="2" weight="medium">
					公開設定 *
				</Text>
				<Select
					options={VISIBILITY_OPTIONS}
					value={visibility}
					onValueChange={setVisibility}
				/>
			</div>
			<TextField label="説明" value={description} onChange={setDescription} />
			{showOptions && (
				<div className={styles.field}>
					<Text size="2" weight="medium">
						選択肢
					</Text>
					{options.map(opt => (
						<OptionRow
							key={opt.id}
							value={opt.label}
							onChange={v => updateOption(opt.id, v)}
							onRemove={() => removeOption(opt.id)}
						/>
					))}
					<Button intent="secondary" size="1" onClick={addOption}>
						<IconPlus size={14} /> 選択肢を追加
					</Button>
				</div>
			)}
			<div className={styles.actions}>
				<Button intent="secondary" size="2" onClick={onCancel}>
					キャンセル
				</Button>
				<Button
					intent="primary"
					size="2"
					loading={loading}
					onClick={handleSubmit}
				>
					追加
				</Button>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// FORM_ITEMカラム追加フォーム
// ─────────────────────────────────────────────────────────────

type CreateFormItemFormProps = {
	columns: ApiColumn[];
	onSuccess: () => void;
	onCancel: () => void;
};

function CreateFormItemForm({
	columns,
	onSuccess,
	onCancel,
}: CreateFormItemFormProps) {
	const [forms, setForms] = useState<ListMyFormsResponse["forms"]>([]);
	const [selectedFormId, setSelectedFormId] = useState("");
	const [items, setItems] = useState<FormItem[]>([]);
	const [selectedItemId, setSelectedItemId] = useState("");
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [loading, setLoading] = useState(false);
	const [formsLoading, setFormsLoading] = useState(true);

	useEffect(() => {
		listMyForms()
			.then(res => setForms(res.forms))
			.catch(() => toast.error("フォーム一覧の取得に失敗しました"))
			.finally(() => setFormsLoading(false));
	}, []);

	useEffect(() => {
		if (!selectedFormId) {
			setItems([]);
			return;
		}
		setItems([]);
		setSelectedItemId("");
		getFormDetail(selectedFormId)
			.then(res => setItems(res.form.items))
			.catch(() => toast.error("フォームの取得に失敗しました"));
	}, [selectedFormId]);

	function handleItemSelect(itemId: string) {
		setSelectedItemId(itemId);
		const item = items.find(i => i.id === itemId);
		if (item && !name) {
			setName(item.label);
		}
	}

	async function handleSubmit() {
		if (!name.trim() || !selectedItemId) {
			toast.error("フォーム項目とカラム名を選択・入力してください");
			return;
		}
		setLoading(true);
		try {
			await createMastersheetColumn({
				type: "FORM_ITEM",
				name: name.trim(),
				description: description.trim() || undefined,
				sortOrder: columns.length,
				formItemId: selectedItemId,
			});
			toast.success("カラムを追加しました");
			onSuccess();
		} catch (error) {
			toast.error(isClientError(error) ? error.message : "追加に失敗しました");
		} finally {
			setLoading(false);
		}
	}

	const formOptions = forms.map(f => ({ value: f.id, label: f.title }));
	const itemOptions = items.map(i => ({ value: i.id, label: i.label }));

	return (
		<div className={styles.form}>
			<div className={styles.field}>
				<Text as="label" size="2" weight="medium">
					フォーム *
				</Text>
				<Select
					options={formOptions}
					value={selectedFormId}
					onValueChange={setSelectedFormId}
					placeholder={formsLoading ? "読み込み中..." : "フォームを選択"}
					disabled={formsLoading}
				/>
			</div>
			<div className={styles.field}>
				<Text as="label" size="2" weight="medium">
					フォーム項目 *
				</Text>
				<Select
					options={itemOptions}
					value={selectedItemId}
					onValueChange={handleItemSelect}
					placeholder="項目を選択"
					disabled={!selectedFormId || items.length === 0}
				/>
			</div>
			<TextField label="カラム名" value={name} onChange={setName} required />
			<TextField label="説明" value={description} onChange={setDescription} />
			<div className={styles.actions}>
				<Button intent="secondary" size="2" onClick={onCancel}>
					キャンセル
				</Button>
				<Button
					intent="primary"
					size="2"
					loading={loading}
					onClick={handleSubmit}
				>
					追加
				</Button>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// カラム追加タブ
// ─────────────────────────────────────────────────────────────

type CreateColumnTabProps = {
	columns: ApiColumn[];
	onSuccess: () => void;
	onCancel: () => void;
};

function CreateColumnTab({
	columns,
	onSuccess,
	onCancel,
}: CreateColumnTabProps) {
	const [columnType, setColumnType] = useState("CUSTOM");

	return (
		<div className={styles.form}>
			<div className={styles.field}>
				<Text as="label" size="2" weight="medium">
					カラム種別
				</Text>
				<Select
					options={COLUMN_TYPE_OPTIONS}
					value={columnType}
					onValueChange={setColumnType}
				/>
			</div>
			{columnType === "CUSTOM" ? (
				<CreateCustomForm
					columns={columns}
					onSuccess={onSuccess}
					onCancel={onCancel}
				/>
			) : (
				<CreateFormItemForm
					columns={columns}
					onSuccess={onSuccess}
					onCancel={onCancel}
				/>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// メインダイアログ
// ─────────────────────────────────────────────────────────────

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	columns: GetMastersheetDataResponse["columns"];
	onSuccess: () => void;
};

export function ColumnManagerDialog({
	open,
	onOpenChange,
	columns,
	onSuccess,
}: Props) {
	const [activeTab, setActiveTab] = useState<"list" | "create">("list");

	function handleCreateSuccess() {
		onSuccess();
		setActiveTab("list");
	}

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="560px">
				<div className={styles.header}>
					<Dialog.Title mb="0">カラムを管理</Dialog.Title>
					<IconButton aria-label="閉じる" onClick={() => onOpenChange(false)}>
						<IconX size={16} />
					</IconButton>
				</div>
				<Tabs.Root
					value={activeTab}
					onValueChange={v => setActiveTab(v as "list" | "create")}
				>
					<Tabs.List>
						<Tabs.Trigger value="list">カラム一覧</Tabs.Trigger>
						<Tabs.Trigger value="create">カラムを追加</Tabs.Trigger>
					</Tabs.List>
					<Box pt="3">
						<Tabs.Content value="list">
							{columns.length === 0 ? (
								<div className={styles.emptyState}>
									<Text size="2" color="gray">
										カラムがありません
									</Text>
								</div>
							) : (
								columns.map(col => (
									<ColumnListItem
										key={col.id}
										col={col}
										onSuccess={onSuccess}
									/>
								))
							)}
						</Tabs.Content>
						<Tabs.Content value="create">
							<CreateColumnTab
								columns={columns}
								onSuccess={handleCreateSuccess}
								onCancel={() => setActiveTab("list")}
							/>
						</Tabs.Content>
					</Box>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
}
