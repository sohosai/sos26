import {
	Badge,
	Dialog,
	Flex,
	TextField as RadixTextField,
	Separator,
	Text,
} from "@radix-ui/themes";
import type {
	DiscoverMastersheetColumnsResponse,
	FormItem,
	GetMastersheetDataResponse,
	ListMyFormsResponse,
	MastersheetColumnVisibility,
	MastersheetDataType,
} from "@sos26/shared";
import {
	IconEdit,
	IconPlus,
	IconSearch,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import type { VisibilityState } from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, IconButton, Select, TextField } from "@/components/primitives";
import { getFormDetail, listMyForms } from "@/lib/api/committee-form";
import {
	createMastersheetAccessRequest,
	createMastersheetColumn,
	deleteMastersheetColumn,
	discoverMastersheetColumns,
	updateMastersheetColumn,
} from "@/lib/api/committee-mastersheet";
import { isClientError } from "@/lib/http/error";
import styles from "./ColumnPanel.module.scss";

// ─────────────────────────────────────────────────────────────
// 型定義・定数
// ─────────────────────────────────────────────────────────────

type ApiColumn = GetMastersheetDataResponse["columns"][number];
type DiscoverColumn = DiscoverMastersheetColumnsResponse["columns"][number];

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

// ─────────────────────────────────────────────────────────────
// 選択肢行（作成フォーム内）
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
// カラム編集フォーム
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
// アクセス済みカラムカード（表示中 / 非表示セクション）
// ─────────────────────────────────────────────────────────────

type AccessibleColumnRowProps = {
	col: ApiColumn;
	isVisible: boolean;
	onToggle: (visible: boolean) => void;
	onSuccess: () => void;
};

function AccessibleColumnRow({
	col,
	isVisible,
	onToggle,
	onSuccess,
}: AccessibleColumnRowProps) {
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

	const typeLabel =
		col.type === "FORM_ITEM"
			? "フォーム"
			: (DATA_TYPE_LABEL[col.dataType ?? ""] ?? "カスタム");

	return (
		<div className={styles.columnCard}>
			<div className={styles.cardTop}>
				<div className={styles.cardContent}>
					<div className={styles.cardTitleRow}>
						<div className={styles.cardName}>
							<Text size="2" weight="medium" truncate>
								{col.name}
							</Text>
							<Badge
								size="1"
								color={col.type === "FORM_ITEM" ? "blue" : "gray"}
							>
								{typeLabel}
							</Badge>
						</div>
						<Flex align="center" gap="2" style={{ flexShrink: 0 }}>
							{col.isOwner && !confirmingDelete && (
								<div className={styles.ownerActions}>
									<IconButton
										aria-label="編集"
										size="1"
										onClick={() => setIsEditing(p => !p)}
									>
										<IconEdit size={14} />
									</IconButton>
									<IconButton
										aria-label="削除"
										size="1"
										intent="danger"
										onClick={() => setConfirmingDelete(true)}
									>
										<IconTrash size={14} />
									</IconButton>
								</div>
							)}
							<Button
								size="1"
								intent={isVisible ? "secondary" : "primary"}
								onClick={() => onToggle(!isVisible)}
							>
								{isVisible ? "非表示にする" : "表示する"}
							</Button>
						</Flex>
					</div>
					{col.description && (
						<Text size="1" color="gray">
							{col.description}
						</Text>
					)}
					{confirmingDelete && (
						<div className={styles.confirmDelete}>
							<Text size="1" color="gray">
								削除すると元に戻せません。
							</Text>
							<Flex gap="2" mt="2">
								<Button
									intent="danger"
									size="1"
									loading={deleteLoading}
									onClick={handleDelete}
								>
									削除
								</Button>
								<Button
									intent="secondary"
									size="1"
									onClick={() => setConfirmingDelete(false)}
								>
									キャンセル
								</Button>
							</Flex>
						</div>
					)}
				</div>
			</div>
			{isEditing && (
				<div className={styles.cardEditForm}>
					<EditColumnForm
						col={col}
						onSuccess={() => {
							setIsEditing(false);
							onSuccess();
						}}
						onCancel={() => setIsEditing(false)}
					/>
				</div>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// 閲覧申請カラムカード（参加可能セクション）
// ─────────────────────────────────────────────────────────────

type RequestableColumnRowProps = {
	col: DiscoverColumn;
	requesting: boolean;
	onRequest: () => void;
};

function RequestableColumnRow({
	col,
	requesting,
	onRequest,
}: RequestableColumnRowProps) {
	return (
		<div className={styles.columnCard}>
			<div className={styles.cardTop}>
				<div className={styles.cardContent}>
					<div className={styles.cardTitleRow}>
						<div className={styles.cardName}>
							<Text size="2" weight="medium" truncate>
								{col.name}
							</Text>
							<Badge
								size="1"
								color={col.type === "FORM_ITEM" ? "blue" : "gray"}
							>
								{col.type === "FORM_ITEM" ? "フォーム" : "カスタム"}
							</Badge>
						</div>
						<div style={{ flexShrink: 0 }}>
							{col.pendingRequest ? (
								<Badge color="orange">申請中</Badge>
							) : (
								<Button
									size="1"
									intent="primary"
									loading={requesting}
									onClick={onRequest}
								>
									閲覧申請
								</Button>
							)}
						</div>
					</div>
					{col.description && (
						<Text size="1" color="gray">
							{col.description}
						</Text>
					)}
					<Text size="1" color="gray">
						作成者: {col.createdByName}
					</Text>
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// カスタムカラム作成フォーム
// ─────────────────────────────────────────────────────────────

type OptionEntry = { id: number; label: string };

type CreateCustomFormProps = {
	columns: ApiColumn[];
	onSuccess: () => void;
	onCancel: () => void;
};

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
// フォーム項目カラム作成フォーム
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
		if (item && !name) setName(item.label);
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
// カラム追加フォーム（種別選択）
// ─────────────────────────────────────────────────────────────

type CreateColumnFormProps = {
	columns: ApiColumn[];
	onSuccess: () => void;
	onCancel: () => void;
};

function CreateColumnForm({
	columns,
	onSuccess,
	onCancel,
}: CreateColumnFormProps) {
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
// セクションヘッダー
// ─────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
	return (
		<Text size="1" weight="bold" color="gray" className={styles.sectionHeader}>
			{label} · {count}件
		</Text>
	);
}

// ─────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	columns: ApiColumn[];
	columnVisibility: VisibilityState;
	onToggleColumn: (columnId: string, visible: boolean) => void;
	onSuccess: () => void;
};

export function ColumnPanel({
	open,
	onOpenChange,
	columns,
	columnVisibility,
	onToggleColumn,
	onSuccess,
}: Props) {
	const [view, setView] = useState<"list" | "create">("list");
	const [searchText, setSearchText] = useState("");
	const [discoverLoading, setDiscoverLoading] = useState(false);
	const [discoverColumns, setDiscoverColumns] = useState<DiscoverColumn[]>([]);
	const [requesting, setRequesting] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (!open) return;
		setView("list");
		setSearchText("");
		setDiscoverLoading(true);
		discoverMastersheetColumns()
			.then(res => setDiscoverColumns(res.columns))
			.catch(() => toast.error("カラム一覧の取得に失敗しました"))
			.finally(() => setDiscoverLoading(false));
	}, [open]);

	async function handleRequest(columnId: string) {
		setRequesting(prev => new Set(prev).add(columnId));
		try {
			await createMastersheetAccessRequest(columnId);
			toast.success("閲覧申請を送信しました");
			setDiscoverColumns(prev =>
				prev.map(c => (c.id === columnId ? { ...c, pendingRequest: true } : c))
			);
		} catch (error) {
			toast.error(isClientError(error) ? error.message : "申請に失敗しました");
		} finally {
			setRequesting(prev => {
				const next = new Set(prev);
				next.delete(columnId);
				return next;
			});
		}
	}

	function handleCreateSuccess() {
		onSuccess();
		setView("list");
	}

	const query = searchText.toLowerCase();
	const filteredColumns = query
		? columns.filter(c => c.name.toLowerCase().includes(query))
		: columns;
	const requestable = discoverColumns.filter(
		c => !c.hasAccess && (!query || c.name.toLowerCase().includes(query))
	);

	const visibleColumns = filteredColumns.filter(
		c => columnVisibility[c.id] !== false
	);
	const hiddenColumns = filteredColumns.filter(
		c => columnVisibility[c.id] === false
	);

	const isEmpty =
		!discoverLoading &&
		visibleColumns.length === 0 &&
		hiddenColumns.length === 0 &&
		requestable.length === 0;

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="800px" minHeight="560px">
				<div className={styles.header}>
					<Dialog.Title mb="0">カラム</Dialog.Title>
					<Flex gap="2" align="center">
						{view === "list" && (
							<Button
								intent="secondary"
								size="2"
								onClick={() => setView("create")}
							>
								<IconPlus size={16} /> 追加
							</Button>
						)}
						<IconButton aria-label="閉じる" onClick={() => onOpenChange(false)}>
							<IconX size={16} />
						</IconButton>
					</Flex>
				</div>

				{view === "create" ? (
					<CreateColumnForm
						columns={columns}
						onSuccess={handleCreateSuccess}
						onCancel={() => setView("list")}
					/>
				) : (
					<>
						<div className={styles.searchBar}>
							<RadixTextField.Root
								placeholder="カラムを検索..."
								value={searchText}
								onChange={e => setSearchText(e.target.value)}
							>
								<RadixTextField.Slot>
									<IconSearch size={14} />
								</RadixTextField.Slot>
							</RadixTextField.Root>
						</div>

						<div className={styles.list}>
							{isEmpty && (
								<Text size="2" color="gray" className={styles.emptyMessage}>
									カラムがありません
								</Text>
							)}

							{visibleColumns.length > 0 && (
								<>
									<SectionHeader label="表示中" count={visibleColumns.length} />
									{visibleColumns.map(col => (
										<AccessibleColumnRow
											key={col.id}
											col={col}
											isVisible={true}
											onToggle={v => onToggleColumn(col.id, v)}
											onSuccess={onSuccess}
										/>
									))}
								</>
							)}

							{hiddenColumns.length > 0 && (
								<>
									{visibleColumns.length > 0 && (
										<Separator size="4" className={styles.separator} />
									)}
									<SectionHeader label="非表示" count={hiddenColumns.length} />
									{hiddenColumns.map(col => (
										<AccessibleColumnRow
											key={col.id}
											col={col}
											isVisible={false}
											onToggle={v => onToggleColumn(col.id, v)}
											onSuccess={onSuccess}
										/>
									))}
								</>
							)}

							{!discoverLoading && requestable.length > 0 && (
								<>
									{(visibleColumns.length > 0 || hiddenColumns.length > 0) && (
										<Separator size="4" className={styles.separator} />
									)}
									<SectionHeader label="参加可能" count={requestable.length} />
									{requestable.map(col => (
										<RequestableColumnRow
											key={col.id}
											col={col}
											requesting={requesting.has(col.id)}
											onRequest={() => handleRequest(col.id)}
										/>
									))}
								</>
							)}

							{discoverLoading && (
								<Text size="2" color="gray" className={styles.emptyMessage}>
									読み込み中...
								</Text>
							)}
						</div>
					</>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
}
