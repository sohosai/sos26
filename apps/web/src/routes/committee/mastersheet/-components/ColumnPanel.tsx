import {
	Badge,
	Dialog,
	TextField as RadixTextField,
	Separator,
	Text,
} from "@radix-ui/themes";
import type {
	DiscoverMastersheetColumnsResponse,
	GetMastersheetDataResponse,
	ListMastersheetAccessRequestsResponse,
	MastersheetViewerInput,
	ProjectRegistrationFormItem,
} from "@sos26/shared";
import { bureauLabelMap } from "@sos26/shared";
import {
	IconChevronDown,
	IconEdit,
	IconPlus,
	IconSearch,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import type { VisibilityState } from "@tanstack/react-table";
import type React from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, IconButton, Switch, TextField } from "@/components/primitives";
import {
	createMastersheetAccessRequest,
	createMastersheetColumn,
	deleteMastersheetColumn,
	discoverMastersheetColumns,
	listMastersheetAccessRequests,
	updateMastersheetAccessRequest,
	updateMastersheetColumn,
} from "@/lib/api/committee-mastersheet";
import { listCommitteeMembersPicker } from "@/lib/api/committee-member";
import {
	getProjectRegistrationFormDetail,
	listProjectRegistrationForms,
} from "@/lib/api/committee-project-registration-form";
import { isClientError } from "@/lib/http/error";
import { AddCustomColumnDialog } from "./AddCustomColumnDialog";
import { AddFormItemColumnsDialog } from "./AddFormItemColumnsDialog";
import styles from "./ColumnPanel.module.scss";
import { getScopeColor, ViewerSelector } from "./ViewerSelector";

// ─────────────────────────────────────────────────────────────
// 型定義・定数
// ─────────────────────────────────────────────────────────────

type ApiColumn = GetMastersheetDataResponse["columns"][number];
type DiscoverColumn = DiscoverMastersheetColumnsResponse["columns"][number];
type AccessRequest = ListMastersheetAccessRequestsResponse["requests"][number];

const DATA_TYPE_LABEL: Record<string, string> = {
	TEXT: "テキスト",
	NUMBER: "数値",
	SELECT: "単一選択",
	MULTI_SELECT: "複数選択",
};

const FIXED_COLUMNS = [
	{ id: "number", name: "企画番号" },
	{ id: "name", name: "企画名" },
	{ id: "namePhonetic", name: "企画名（ふりがな）" },
	{ id: "type", name: "企画区分" },
	{ id: "location", name: "企画実施場所" },
	{ id: "organizationName", name: "団体名" },
	{ id: "organizationNamePhonetic", name: "団体名（ふりがな）" },
	{ id: "ownerName", name: "企画責任者" },
	{ id: "ownerEmail", name: "企画責任者メールアドレス" },
	{ id: "ownerTel", name: "企画責任者電話番号" },
	{ id: "subOwnerName", name: "副企画責任者" },
	{ id: "subOwnerEmail", name: "副企画責任者メールアドレス" },
	{ id: "subOwnerTel", name: "副企画責任者電話番号" },
	{ id: "deletionStatus", name: "企画状況" },
];

const PinColumnContext = createContext<
	((columnId: string, pinned: boolean) => void) | null
>(null);

// ─────────────────────────────────────────────────────────────
// 固定カラム行（トグルのみ、編集・削除なし）
// ─────────────────────────────────────────────────────────────

function FixedColumnRow({
	col,
	isVisible,
	isPinned,
	onToggle,
}: {
	col: { id: string; name: string };
	isVisible: boolean;
	isPinned: boolean;
	onToggle: (visible: boolean) => void;
}) {
	const onTogglePinColumn = useContext(PinColumnContext);

	return (
		<div className={styles.columnCard}>
			<div className={styles.cardTop}>
				<div className={styles.cardContent}>
					<div className={styles.cardTitleRow}>
						<div className={styles.cardName}>
							<Text size="2" weight="medium" truncate>
								{col.name}
							</Text>
						</div>
						<div className={styles.cardRight}>
							<div className={styles.visibilityRow}>
								<Switch
									label="固定"
									size="1"
									checked={isPinned}
									disabled={!isVisible || !onTogglePinColumn}
									onCheckedChange={v => onTogglePinColumn?.(col.id, v)}
								/>
								<Button
									size="1"
									intent={isVisible ? "secondary" : "primary"}
									onClick={() => onToggle(!isVisible)}
								>
									{isVisible ? "非表示にする" : "表示する"}
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// カラムメタデータ表示
// ─────────────────────────────────────────────────────────────

function ColumnMetaBadges({ col }: { col: ApiColumn }) {
	return (
		<div className={styles.cardMeta}>
			<Text size="1" color="gray">
				作成者: {col.createdByName}
			</Text>
			<Text size="1" color="gray">
				|
			</Text>
			{col.type === "FORM_ITEM" ? (
				<Text size="1" color="gray">
					申請のアクセス権に準ずる
				</Text>
			) : col.type === "PROJECT_REGISTRATION_FORM_ITEM" ? (
				<Text size="1" color="gray">
					全実委人がアクセス可能
				</Text>
			) : (
				<div className={styles.viewerBadges}>
					{col.viewers.length === 0 ? (
						<Badge size="1" variant="soft" color="gray">
							非公開
						</Badge>
					) : col.viewers.some(v => v.scope === "ALL") ? (
						<Badge size="1" variant="soft" color="blue">
							全員
						</Badge>
					) : (
						col.viewers.map(v => (
							<Badge
								key={v.id}
								size="1"
								variant="soft"
								color={getScopeColor(v.scope)}
							>
								{v.scope === "BUREAU" && v.bureauValue
									? (bureauLabelMap[v.bureauValue] ?? v.bureauValue)
									: (v.userName ?? "不明")}
							</Badge>
						))
					)}
				</div>
			)}
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

type OptionEntry = { id: number; label: string };

function EditColumnForm({ col, onSuccess, onCancel }: EditColumnFormProps) {
	const [name, setName] = useState(col.name);
	const [description, setDescription] = useState(col.description ?? "");
	const [viewers, setViewers] = useState<MastersheetViewerInput[]>(
		col.viewers.map(v => ({
			scope: v.scope,
			bureauValue: v.bureauValue ?? undefined,
			userId: v.userId ?? undefined,
		}))
	);
	const [committeeMembers, setCommitteeMembers] = useState<
		{ id: string; name: string }[]
	>([]);
	const [loading, setLoading] = useState(false);

	const showOptions =
		col.type === "CUSTOM" &&
		(col.dataType === "SELECT" || col.dataType === "MULTI_SELECT");

	const [options, setOptions] = useState<OptionEntry[]>(() =>
		col.options.map((o, i) => ({ id: i, label: o.label }))
	);
	const nextOptionId = useRef(col.options.length);

	function addOption() {
		setOptions(prev => [...prev, { id: nextOptionId.current++, label: "" }]);
	}

	function removeOption(id: number) {
		setOptions(prev => prev.filter(o => o.id !== id));
	}

	function updateOption(id: number, value: string) {
		setOptions(prev =>
			prev.map(o => (o.id === id ? { ...o, label: value } : o))
		);
	}

	useEffect(() => {
		listCommitteeMembersPicker()
			.then(res =>
				setCommitteeMembers(
					res.committeeMembers.map(m => ({ id: m.user.id, name: m.user.name }))
				)
			)
			.catch(() => toast.error("委員一覧の取得に失敗しました"));
	}, []);

	function buildOptionsInput() {
		if (!showOptions) return undefined;
		return options
			.filter(o => o.label.trim())
			.map((o, i) => ({ label: o.label, sortOrder: i }));
	}

	async function handleSubmit() {
		if (!name.trim()) {
			toast.error("カラム名を入力してください");
			return;
		}
		const optionsInput = buildOptionsInput();
		if (showOptions && (!optionsInput || optionsInput.length === 0)) {
			toast.error("選択肢を1つ以上追加してください");
			return;
		}
		setLoading(true);
		try {
			await updateMastersheetColumn(col.id, {
				name: name.trim(),
				description: description.trim() || null,
				viewers: col.type === "CUSTOM" ? viewers : undefined,
				options: optionsInput,
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
					<Text size="2" weight="medium">
						アクセス権
					</Text>
					<ViewerSelector
						viewers={viewers}
						onChange={setViewers}
						committeeMembers={committeeMembers}
					/>
				</div>
			)}
			{showOptions && (
				<div className={styles.field}>
					<Text size="2" weight="medium">
						選択肢
					</Text>
					{options.map(opt => (
						<div key={opt.id} className={styles.optionRow}>
							<div className={styles.optionInput}>
								<RadixTextField.Root
									size="2"
									value={opt.label}
									placeholder="選択肢のラベル"
									onChange={e => updateOption(opt.id, e.target.value)}
								/>
							</div>
							<IconButton
								aria-label="この選択肢を削除"
								size="1"
								onClick={() => removeOption(opt.id)}
							>
								<IconX size={14} />
							</IconButton>
						</div>
					))}
					<Button intent="secondary" size="1" onClick={addOption}>
						+ 選択肢を追加
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
					保存
				</Button>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// ヘルパー: カラム種別バッジ
// ─────────────────────────────────────────────────────────────

function getColumnTypeLabel(col: { type: string; dataType?: string | null }) {
	if (col.type === "FORM_ITEM") return "申請";
	if (col.type === "PROJECT_REGISTRATION_FORM_ITEM") return "企画登録情報";
	return DATA_TYPE_LABEL[col.dataType ?? ""] ?? "カスタム";
}

function getColumnTypeBadgeColor(type: string) {
	if (type === "FORM_ITEM") return "blue" as const;
	if (type === "PROJECT_REGISTRATION_FORM_ITEM") return "teal" as const;
	return "gray" as const;
}

// ─────────────────────────────────────────────────────────────
// アクセス済みカラムカード（表示中 / 非表示セクション）
// ─────────────────────────────────────────────────────────────

type AccessibleColumnRowProps = {
	col: ApiColumn;
	isVisible: boolean;
	isPinned: boolean;
	onToggle: (visible: boolean) => void;
	onSuccess: () => void;
	accessRequests: AccessRequest[];
	onRequestHandled: (id: string) => void;
};

function AccessibleColumnRow({
	col,
	isVisible,
	isPinned,
	onToggle,
	onSuccess,
	accessRequests,
	onRequestHandled,
}: AccessibleColumnRowProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [showRequests, setShowRequests] = useState(false);
	const [requestLoading, setRequestLoading] = useState<Set<string>>(new Set());

	const onTogglePinColumn = useContext(PinColumnContext);
	const colRequests = accessRequests.filter(r => r.columnId === col.id);

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

	async function handleDecide(
		requestId: string,
		status: "APPROVED" | "REJECTED"
	) {
		setRequestLoading(prev => new Set(prev).add(requestId));
		try {
			await updateMastersheetAccessRequest(requestId, status);
			onRequestHandled(requestId);
			if (status === "APPROVED") {
				onSuccess();
			}
		} catch (error) {
			toast.error(isClientError(error) ? error.message : "操作に失敗しました");
		} finally {
			setRequestLoading(prev => {
				const next = new Set(prev);
				next.delete(requestId);
				return next;
			});
		}
	}

	return (
		<div className={styles.columnCard}>
			<div className={styles.cardTop}>
				<div className={styles.cardContent}>
					<div className={styles.cardTitleRow}>
						<div className={styles.cardName}>
							<Text size="2" weight="medium" truncate>
								{col.name}
							</Text>
							<Badge size="1" color={getColumnTypeBadgeColor(col.type)}>
								{getColumnTypeLabel(col)}
							</Badge>
						</div>
						<div className={styles.cardRight}>
							{colRequests.length > 0 && !confirmingDelete && (
								<button
									type="button"
									className={styles.requestBadgeBtn}
									onClick={() => setShowRequests(p => !p)}
								>
									<Badge color="orange">
										{colRequests.length}件の申請
										<IconChevronDown
											size={10}
											style={{
												transform: showRequests ? "rotate(180deg)" : undefined,
											}}
										/>
									</Badge>
								</button>
							)}
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
							<div className={styles.visibilityRow}>
								<Switch
									label="固定"
									size="1"
									checked={isPinned}
									disabled={!isVisible || !onTogglePinColumn}
									onCheckedChange={v => onTogglePinColumn?.(col.id, v)}
								/>
								<Button
									size="1"
									intent={isVisible ? "secondary" : "primary"}
									onClick={() => onToggle(!isVisible)}
								>
									{isVisible ? "非表示にする" : "表示する"}
								</Button>
							</div>
						</div>
					</div>
					{col.description && (
						<Text size="1" color="gray">
							{col.description}
						</Text>
					)}
					<ColumnMetaBadges col={col} />
					{confirmingDelete && (
						<div className={styles.confirmDelete}>
							<Text size="1" color="gray">
								削除すると元に戻せません。
							</Text>
							<div className={styles.confirmDeleteActions}>
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
							</div>
						</div>
					)}
					{showRequests && colRequests.length > 0 && (
						<div className={styles.requestList}>
							{col.type === "FORM_ITEM" && (
								<Text size="1" color="gray">
									承認すると申請の共同編集者に追加されます
								</Text>
							)}
							{colRequests.map(req => (
								<div key={req.id} className={styles.requestRow}>
									<Text size="2">{req.requester.name}</Text>
									<div className={styles.requestRowActions}>
										<Button
											size="1"
											intent="primary"
											loading={requestLoading.has(req.id)}
											onClick={() => handleDecide(req.id, "APPROVED")}
										>
											承認
										</Button>
										<Button
											size="1"
											intent="danger"
											loading={requestLoading.has(req.id)}
											onClick={() => handleDecide(req.id, "REJECTED")}
										>
											却下
										</Button>
									</div>
								</div>
							))}
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
// アクセス申請カラムカード（他のカラムセクション）
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
							<Badge size="1" color={getColumnTypeBadgeColor(col.type)}>
								{getColumnTypeLabel(col)}
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
									アクセス申請
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
// セクションヘッダー
// ─────────────────────────────────────────────────────────────

function SectionHeader({
	label,
	count,
	isOpen,
	onToggle,
}: {
	label: string;
	count: number;
	isOpen: boolean;
	onToggle: () => void;
}) {
	return (
		<button type="button" className={styles.sectionHeader} onClick={onToggle}>
			<Text size="1" weight="bold" color="gray">
				{label} · {count}件
			</Text>
			<IconChevronDown
				size={12}
				className={`${styles.chevron} ${isOpen ? "" : styles.closed}`}
			/>
		</button>
	);
}

// ─────────────────────────────────────────────────────────────
// アコーディオンセクション
// ─────────────────────────────────────────────────────────────

function Section({
	label,
	count,
	isOpen,
	onToggle,
	children,
}: {
	label: string;
	count: number;
	isOpen: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}) {
	return (
		<>
			<SectionHeader
				label={label}
				count={count}
				isOpen={isOpen}
				onToggle={onToggle}
			/>
			{isOpen && children}
		</>
	);
}

// ─────────────────────────────────────────────────────────────
// 企画登録情報フォームグループ
// ─────────────────────────────────────────────────────────────

type PrfFormSummary = {
	id: string;
	title: string;
};

function PrfFormGroup({
	form,
	addedColumns,
	columnVisibility,
	pinnedColumnIds,
	onToggleColumn,
	onTogglePinColumn,
	onAddAndShow,
	adding,
}: {
	form: PrfFormSummary;
	addedColumns: Map<string, ApiColumn>;
	columnVisibility: VisibilityState;
	pinnedColumnIds: string[];
	onToggleColumn: (columnId: string, visible: boolean) => void;
	onTogglePinColumn: (columnId: string, pinned: boolean) => void;
	onAddAndShow: (item: ProjectRegistrationFormItem) => void;
	adding: Set<string>;
}) {
	const [expanded, setExpanded] = useState(false);
	const [items, setItems] = useState<ProjectRegistrationFormItem[] | null>(
		null
	);
	const [loading, setLoading] = useState(false);

	function handleToggle() {
		const next = !expanded;
		setExpanded(next);
		if (next && items === null && !loading) {
			setLoading(true);
			getProjectRegistrationFormDetail(form.id)
				.then(res => setItems(res.form.items))
				.catch(() => toast.error("企画登録情報の詳細取得に失敗しました"))
				.finally(() => setLoading(false));
		}
	}

	return (
		<div className={styles.columnCard}>
			<div className={styles.cardTop}>
				<div className={styles.cardContent}>
					<div className={styles.cardTitleRow}>
						<button
							type="button"
							className={styles.prfFormHeader}
							onClick={handleToggle}
						>
							<IconChevronDown
								size={14}
								style={{
									flexShrink: 0,
									transform: expanded ? undefined : "rotate(-90deg)",
									transition: "transform 0.15s",
								}}
							/>
							<Text size="2" weight="medium" truncate>
								{form.title}
							</Text>
						</button>
					</div>
				</div>
			</div>
			{expanded && (
				<div className={styles.prfItemList}>
					{loading ? (
						<Text size="2" color="gray">
							読み込み中...
						</Text>
					) : (
						items?.map(item => {
							const col = addedColumns.get(item.id);
							const isVisible = col
								? columnVisibility[col.id] !== false
								: false;
							return (
								<div key={item.id} className={styles.columnCard}>
									<div className={styles.cardTop}>
										<div className={styles.cardContent}>
											<div className={styles.cardTitleRow}>
												<div className={styles.cardName}>
													<Text size="2" weight="medium" truncate>
														{item.label}
													</Text>
												</div>
												{col && (
													<Switch
														label="固定"
														size="1"
														checked={pinnedColumnIds.includes(col.id)}
														disabled={!isVisible}
														onCheckedChange={v => onTogglePinColumn(col.id, v)}
													/>
												)}
												<Button
													size="1"
													intent={isVisible ? "secondary" : "primary"}
													loading={adding.has(item.id)}
													onClick={() => {
														if (col) {
															onToggleColumn(col.id, !isVisible);
														} else {
															onAddAndShow(item);
														}
													}}
												>
													{isVisible ? "非表示にする" : "表示する"}
												</Button>
											</div>
										</div>
									</div>
								</div>
							);
						})
					)}
				</div>
			)}
		</div>
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
	pinnedColumnIds: string[];
	onToggleColumn: (columnId: string, visible: boolean) => void;
	onTogglePinColumn: (columnId: string, pinned: boolean) => void;
	onSuccess: () => void;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: カラムパネルは複数セクション・状態を管理するUI
export function ColumnPanel({
	open,
	onOpenChange,
	columns,
	columnVisibility,
	pinnedColumnIds,
	onToggleColumn,
	onTogglePinColumn,
	onSuccess,
}: Props) {
	const [searchText, setSearchText] = useState("");
	const [discoverLoading, setDiscoverLoading] = useState(false);
	const [discoverColumns, setDiscoverColumns] = useState<DiscoverColumn[]>([]);
	const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
	const [requesting, setRequesting] = useState<Set<string>>(new Set());
	const [addCustomOpen, setAddCustomOpen] = useState(false);
	const [addFormItemOpen, setAddFormItemOpen] = useState(false);
	const [prfForms, setPrfForms] = useState<PrfFormSummary[]>([]);
	const [prfAdding, setPrfAdding] = useState<Set<string>>(new Set());
	const [sectionsOpen, setSectionsOpen] = useState({
		fixed: true,
		prf: true,
		visible: true,
		hidden: true,
		requestable: true,
	});

	function toggleSection(key: keyof typeof sectionsOpen) {
		setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
	}

	useEffect(() => {
		if (!open) return;
		setSearchText("");
		setDiscoverLoading(true);
		discoverMastersheetColumns()
			.then(res => setDiscoverColumns(res.columns))
			.catch(() => toast.error("カラム一覧の取得に失敗しました"))
			.finally(() => setDiscoverLoading(false));

		listProjectRegistrationForms()
			.then(res => {
				const activeForms = res.forms.filter(f => f.isActive);
				setPrfForms(activeForms.map(f => ({ id: f.id, title: f.title })));
			})
			.catch(() => toast.error("企画登録情報一覧の取得に失敗しました"));
	}, [open]);

	useEffect(() => {
		if (!open) return;
		listMastersheetAccessRequests()
			.then(res => setAccessRequests(res.requests))
			.catch(() => toast.error("アクセス申請一覧の取得に失敗しました"));
	}, [open]);

	function handleRequestHandled(id: string) {
		setAccessRequests(prev => prev.filter(r => r.id !== id));
	}

	async function handleRequest(columnId: string) {
		setRequesting(prev => new Set(prev).add(columnId));
		try {
			await createMastersheetAccessRequest(columnId);
			toast.success("アクセス申請を送信しました");
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

	// 企画登録情報: formItemId → カラム のマップ
	const prfItemToColumn = new Map(
		columns
			.filter(
				c =>
					c.type === "PROJECT_REGISTRATION_FORM_ITEM" &&
					c.projectRegistrationFormItemId
			)
			.map(c => [c.projectRegistrationFormItemId as string, c] as const)
	);

	async function handleAddAndShowPrfItem(item: ProjectRegistrationFormItem) {
		setPrfAdding(prev => new Set(prev).add(item.id));
		try {
			await createMastersheetColumn({
				type: "PROJECT_REGISTRATION_FORM_ITEM",
				name: item.label,
				sortOrder: columns.length,
				projectRegistrationFormItemId: item.id,
			});
			onSuccess();
		} catch (error) {
			toast.error(isClientError(error) ? error.message : "追加に失敗しました");
		} finally {
			setPrfAdding(prev => {
				const next = new Set(prev);
				next.delete(item.id);
				return next;
			});
		}
	}

	const query = searchText.toLowerCase();
	const filteredFixedColumns = FIXED_COLUMNS.filter(
		c => !query || c.name.includes(query)
	);
	// 企画登録情報カラムは専用セクションに表示するため分離
	const nonPrfColumns = columns.filter(
		c => c.type !== "PROJECT_REGISTRATION_FORM_ITEM"
	);
	const filteredColumns = query
		? nonPrfColumns.filter(c => c.name.toLowerCase().includes(query))
		: nonPrfColumns;
	const filteredPrfForms = query
		? prfForms.filter(f => f.title.toLowerCase().includes(query))
		: prfForms;
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
		filteredFixedColumns.length === 0 &&
		filteredPrfForms.length === 0 &&
		visibleColumns.length === 0 &&
		hiddenColumns.length === 0 &&
		requestable.length === 0;

	return (
		<>
			<Dialog.Root open={open} onOpenChange={onOpenChange}>
				<Dialog.Content maxWidth="800px" minHeight="560px">
					<div className={styles.header}>
						<Dialog.Title mb="0">カラム</Dialog.Title>
						<div className={styles.headerActions}>
							<Button
								intent="secondary"
								size="2"
								onClick={() => setAddFormItemOpen(true)}
							>
								<IconPlus size={16} /> 申請から追加
							</Button>
							<Button
								intent="secondary"
								size="2"
								onClick={() => setAddCustomOpen(true)}
							>
								<IconPlus size={16} /> カスタム追加
							</Button>
							<IconButton
								aria-label="閉じる"
								onClick={() => onOpenChange(false)}
							>
								<IconX size={16} />
							</IconButton>
						</div>
					</div>

					<div className={styles.searchBar}>
						<RadixTextField.Root
							placeholder="カラムを検索..."
							aria-label="カラムを検索"
							value={searchText}
							onChange={e => setSearchText(e.target.value)}
						>
							<RadixTextField.Slot>
								<IconSearch size={14} />
							</RadixTextField.Slot>
						</RadixTextField.Root>
					</div>

					<PinColumnContext.Provider value={onTogglePinColumn}>
						<div className={styles.list}>
							{isEmpty && (
								<Text size="2" color="gray" className={styles.emptyMessage}>
									カラムがありません
								</Text>
							)}

							{filteredFixedColumns.length > 0 && (
								<>
									<Section
										label="基本カラム"
										count={filteredFixedColumns.length}
										isOpen={sectionsOpen.fixed}
										onToggle={() => toggleSection("fixed")}
									>
										{filteredFixedColumns.map(col => (
											<FixedColumnRow
												key={col.id}
												col={col}
												isVisible={columnVisibility[col.id] !== false}
												isPinned={pinnedColumnIds.includes(col.id)}
												onToggle={v => onToggleColumn(col.id, v)}
											/>
										))}
									</Section>
									{(filteredPrfForms.length > 0 ||
										visibleColumns.length > 0 ||
										hiddenColumns.length > 0 ||
										(!discoverLoading && requestable.length > 0)) && (
										<Separator size="4" className={styles.separator} />
									)}
								</>
							)}

							{filteredPrfForms.length > 0 && (
								<>
									<Section
										label="企画登録情報"
										count={filteredPrfForms.length}
										isOpen={sectionsOpen.prf}
										onToggle={() => toggleSection("prf")}
									>
										{filteredPrfForms.map(form => (
											<PrfFormGroup
												key={form.id}
												form={form}
												addedColumns={prfItemToColumn}
												columnVisibility={columnVisibility}
												pinnedColumnIds={pinnedColumnIds}
												onToggleColumn={onToggleColumn}
												onTogglePinColumn={onTogglePinColumn}
												onAddAndShow={handleAddAndShowPrfItem}
												adding={prfAdding}
											/>
										))}
									</Section>
									{(visibleColumns.length > 0 ||
										hiddenColumns.length > 0 ||
										(!discoverLoading && requestable.length > 0)) && (
										<Separator size="4" className={styles.separator} />
									)}
								</>
							)}

							{visibleColumns.length > 0 && (
								<Section
									label="表示中"
									count={visibleColumns.length}
									isOpen={sectionsOpen.visible}
									onToggle={() => toggleSection("visible")}
								>
									{visibleColumns.map(col => (
										<AccessibleColumnRow
											key={col.id}
											col={col}
											isVisible={true}
											isPinned={pinnedColumnIds.includes(col.id)}
											onToggle={v => onToggleColumn(col.id, v)}
											onSuccess={onSuccess}
											accessRequests={accessRequests}
											onRequestHandled={handleRequestHandled}
										/>
									))}
								</Section>
							)}

							{hiddenColumns.length > 0 && (
								<>
									{visibleColumns.length > 0 && (
										<Separator size="4" className={styles.separator} />
									)}
									<Section
										label="非表示"
										count={hiddenColumns.length}
										isOpen={sectionsOpen.hidden}
										onToggle={() => toggleSection("hidden")}
									>
										{hiddenColumns.map(col => (
											<AccessibleColumnRow
												key={col.id}
												col={col}
												isVisible={false}
												isPinned={pinnedColumnIds.includes(col.id)}
												onToggle={v => onToggleColumn(col.id, v)}
												onSuccess={onSuccess}
												accessRequests={accessRequests}
												onRequestHandled={handleRequestHandled}
											/>
										))}
									</Section>
								</>
							)}

							{!discoverLoading && requestable.length > 0 && (
								<>
									{(visibleColumns.length > 0 || hiddenColumns.length > 0) && (
										<Separator size="4" className={styles.separator} />
									)}
									<Section
										label="他のカラム"
										count={requestable.length}
										isOpen={sectionsOpen.requestable}
										onToggle={() => toggleSection("requestable")}
									>
										{requestable.map(col => (
											<RequestableColumnRow
												key={col.id}
												col={col}
												requesting={requesting.has(col.id)}
												onRequest={() => handleRequest(col.id)}
											/>
										))}
									</Section>
								</>
							)}

							{discoverLoading && (
								<Text size="2" color="gray" className={styles.emptyMessage}>
									読み込み中...
								</Text>
							)}
						</div>
					</PinColumnContext.Provider>
				</Dialog.Content>
			</Dialog.Root>

			<AddFormItemColumnsDialog
				open={addFormItemOpen}
				onOpenChange={setAddFormItemOpen}
				columns={columns}
				onSuccess={onSuccess}
			/>
			<AddCustomColumnDialog
				open={addCustomOpen}
				onOpenChange={setAddCustomOpen}
				columns={columns}
				onSuccess={onSuccess}
			/>
		</>
	);
}
