import { Dialog, Text, Tooltip } from "@radix-ui/themes";
import type {
	GetMastersheetDataResponse,
	ListMastersheetViewsResponse,
} from "@sos26/shared";
import { type ProjectType, projectTypeSchema } from "@sos26/shared";
import {
	IconCheck,
	IconFileText,
	IconPencil,
	IconX,
} from "@tabler/icons-react";
import {
	type ColumnDef,
	type ColumnFiltersState,
	createColumnHelper,
	type RowSelectionState,
	type SortingState,
	type VisibilityState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/patterns/DataTable";
import { Button, IconButton } from "@/components/primitives";
import {
	getMastersheetData,
	listMastersheetViews,
} from "@/lib/api/committee-mastersheet";
import { formatProjectNumber } from "@/lib/format";
import styles from "./ProjectSelectDialog.module.scss";

// ─── マスターシート行型 ─────────────────────────────────

type MastersheetRow = {
	project: GetMastersheetDataResponse["rows"][number]["project"];
	cells: Record<
		string,
		GetMastersheetDataResponse["rows"][number]["cells"][number]
	>;
};

type ApiColumn = GetMastersheetDataResponse["columns"][number];
type SavedView = ListMastersheetViewsResponse["views"][number];

type ViewState = {
	sorting?: SortingState;
	knownColumnIds?: string[];
	columnFilters?: ColumnFiltersState;
};

// ─── 固定カラム ──────────────────────────────────────────

const PROJECT_TYPE_LABEL = {
	STAGE: "ステージ企画",
	FOOD: "食品企画",
	NORMAL: "普通企画",
} satisfies Record<ProjectType, string>;

const FIXED_COLUMN_IDS = [
	"number",
	"name",
	"type",
	"organizationName",
	"ownerName",
	"subOwnerName",
] as const;

const columnHelper = createColumnHelper<MastersheetRow>();

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table requires any for mixed column value types
const fixedColumns: ColumnDef<MastersheetRow, any>[] = [
	columnHelper.accessor(row => row.project.number, {
		id: "number",
		header: "企画番号",
		cell: ctx => (
			<Text size="2" weight="medium">
				{formatProjectNumber(ctx.getValue() as number)}
			</Text>
		),
		meta: { filterVariant: "text" },
		filterFn: (row, columnId, filterValue) => {
			const raw = row.getValue(columnId) as number | null | undefined;
			if (raw == null) return false;

			const query = String(filterValue ?? "").trim();
			if (query === "") return true;

			const valueStr = String(raw);
			const formatted = formatProjectNumber(raw);

			return valueStr.includes(query) || formatted.includes(query);
		},
	}),
	columnHelper.accessor(row => row.project.name, {
		id: "name",
		header: "企画名",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
		meta: { filterVariant: "text" },
	}),
	columnHelper.accessor(row => row.project.type, {
		id: "type",
		header: "企画区分",
		cell: ctx => (
			<Text size="2">{PROJECT_TYPE_LABEL[ctx.getValue() as ProjectType]}</Text>
		),
		meta: {
			filterVariant: "select",
			selectOptions: projectTypeSchema.options.map(v => ({
				value: v,
				label: PROJECT_TYPE_LABEL[v],
			})),
		},
	}),
	columnHelper.accessor(row => row.project.organizationName, {
		id: "organizationName",
		header: "団体名",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
		meta: { filterVariant: "text" },
	}),
	columnHelper.accessor(row => row.project.owner.name, {
		id: "ownerName",
		header: "責任者",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
		meta: { filterVariant: "text" },
	}),
	columnHelper.accessor(row => row.project.subOwner?.name ?? "", {
		id: "subOwnerName",
		header: "副責任者",
		cell: ctx => {
			const name = ctx.getValue() as string;
			if (!name)
				return (
					<Text size="2" color="gray">
						─
					</Text>
				);
			return <Text size="2">{name}</Text>;
		},
		meta: { filterVariant: "text" },
	}),
];

// ─── 動的カラム（読み取り専用） ──────────────────────────

function ColHeader({ col }: { col: ApiColumn }) {
	return (
		<span className={styles.colHeader}>
			{col.type === "FORM_ITEM" ? (
				<Tooltip content="申請由来カラム">
					<IconFileText
						size={12}
						style={{ color: "var(--gray-8)", flexShrink: 0 }}
					/>
				</Tooltip>
			) : (
				<Tooltip content="カスタムカラム">
					<IconPencil
						size={12}
						style={{ color: "var(--gray-8)", flexShrink: 0 }}
					/>
				</Tooltip>
			)}
			{col.name}
		</span>
	);
}

function getOptionLabel(col: ApiColumn, optionId: string): string {
	return col.options.find(o => o.id === optionId)?.label ?? optionId;
}

/** 読み取り専用の動的カラムを生成 */
function buildReadOnlyDynamicColumn(
	col: ApiColumn
): ColumnDef<MastersheetRow, unknown> {
	if (
		col.type === "FORM_ITEM" ||
		col.type === "PROJECT_REGISTRATION_FORM_ITEM"
	) {
		const itemType = col.formItemType ?? col.projectRegistrationFormItemType;
		const selectOptions = col.options.map(o => ({
			value: o.id,
			label: o.label,
		}));

		if (itemType === "SELECT") {
			return columnHelper.accessor(
				row => row.cells[col.id]?.formValue?.selectedOptionIds?.[0] ?? "",
				{
					id: col.id,
					header: () => <ColHeader col={col} />,
					cell: ctx => {
						const val = ctx.getValue() as string;
						return <Text size="2">{val ? getOptionLabel(col, val) : "─"}</Text>;
					},
					meta: { filterVariant: "select", selectOptions },
				}
			);
		}

		if (itemType === "CHECKBOX") {
			return columnHelper.accessor(
				row => row.cells[col.id]?.formValue?.selectedOptionIds ?? [],
				{
					id: col.id,
					header: () => <ColHeader col={col} />,
					cell: ctx => {
						const ids = ctx.getValue() as string[];
						if (ids.length === 0)
							return (
								<Text size="2" color="gray">
									─
								</Text>
							);
						return (
							<Text size="2">
								{ids.map(id => getOptionLabel(col, id)).join(", ")}
							</Text>
						);
					},
					meta: { filterVariant: "select", selectOptions },
				}
			);
		}

		if (itemType === "NUMBER") {
			return columnHelper.accessor(
				row => row.cells[col.id]?.formValue?.numberValue ?? null,
				{
					id: col.id,
					header: () => <ColHeader col={col} />,
					cell: ctx => {
						const val = ctx.getValue() as number | null;
						return <Text size="2">{val != null ? val : "─"}</Text>;
					},
					meta: { filterVariant: "number" },
				}
			);
		}

		if (itemType === "FILE") {
			return columnHelper.accessor(
				row => row.cells[col.id]?.formValue?.files ?? [],
				{
					id: col.id,
					header: () => <ColHeader col={col} />,
					cell: ctx => {
						const files = ctx.getValue() as NonNullable<
							GetMastersheetDataResponse["rows"][number]["cells"][number]["formValue"]
						>["files"];
						const [first, ...rest] = files;
						return first ? (
							<Text size="2" color="blue" truncate>
								{first.fileName}
								{rest.length > 0 ? ` +${rest.length}件` : ""}
							</Text>
						) : (
							<Text size="2" color="gray">
								─
							</Text>
						);
					},
					meta: { filterVariant: "text" },
				}
			);
		}

		// TEXT / TEXTAREA
		return columnHelper.accessor(
			row => row.cells[col.id]?.formValue?.textValue ?? "",
			{
				id: col.id,
				header: () => <ColHeader col={col} />,
				cell: ctx => {
					const val = ctx.getValue() as string;
					return <Text size="2">{val || "─"}</Text>;
				},
				meta: { filterVariant: "text" },
			}
		);
	}

	// CUSTOM columns
	const selectOptions = col.options.map(o => ({
		value: o.id,
		label: o.label,
	}));

	if (col.dataType === "SELECT") {
		return columnHelper.accessor(
			row => row.cells[col.id]?.cellValue?.selectedOptionIds?.[0] ?? "",
			{
				id: col.id,
				header: () => <ColHeader col={col} />,
				cell: ctx => {
					const val = ctx.getValue() as string;
					return <Text size="2">{val ? getOptionLabel(col, val) : "─"}</Text>;
				},
				meta: { filterVariant: "select", selectOptions },
			}
		);
	}

	if (col.dataType === "MULTI_SELECT") {
		return columnHelper.accessor(
			row => row.cells[col.id]?.cellValue?.selectedOptionIds ?? [],
			{
				id: col.id,
				header: () => <ColHeader col={col} />,
				cell: ctx => {
					const ids = ctx.getValue() as string[];
					if (ids.length === 0)
						return (
							<Text size="2" color="gray">
								─
							</Text>
						);
					return (
						<Text size="2">
							{ids.map(id => getOptionLabel(col, id)).join(", ")}
						</Text>
					);
				},
				meta: { filterVariant: "select", selectOptions },
			}
		);
	}

	if (col.dataType === "NUMBER") {
		return columnHelper.accessor(
			row => row.cells[col.id]?.cellValue?.numberValue ?? null,
			{
				id: col.id,
				header: () => <ColHeader col={col} />,
				cell: ctx => {
					const val = ctx.getValue() as number | null;
					return <Text size="2">{val != null ? val : "─"}</Text>;
				},
				meta: { filterVariant: "number" },
			}
		);
	}

	// TEXT (default)
	return columnHelper.accessor(
		row => row.cells[col.id]?.cellValue?.textValue ?? "",
		{
			id: col.id,
			header: () => <ColHeader col={col} />,
			cell: ctx => {
				const val = ctx.getValue() as string;
				return <Text size="2">{val || "─"}</Text>;
			},
			meta: { filterVariant: "text" },
		}
	);
}

// ─── ビュー選択タブ（読み取り専用） ──────────────────────

function ReadOnlyViewTabs({
	views,
	activeViewId,
	onSelectView,
}: {
	views: SavedView[];
	activeViewId: string | null;
	onSelectView: (view: SavedView) => void;
}) {
	return (
		<div className={styles.viewTabs}>
			{views.map(view => (
				<button
					key={view.id}
					type="button"
					className={`${styles.viewTab} ${view.id === activeViewId ? styles.viewTabActive : ""}`}
					onClick={() => onSelectView(view)}
				>
					{view.name}
				</button>
			))}
		</div>
	);
}

// ─── メインコンポーネント ────────────────────────────────

type ProjectSelectDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedIds: Set<string>;
	onConfirm: (ids: Set<string>) => void;
	title?: string;
};

export function ProjectSelectDialog({
	open,
	onOpenChange,
	selectedIds,
	onConfirm,
	title = "配信先企画を選択",
}: ProjectSelectDialogProps) {
	const [apiColumns, setApiColumns] = useState<ApiColumn[]>([]);
	const [apiRows, setApiRows] = useState<GetMastersheetDataResponse["rows"]>(
		[]
	);
	const [views, setViews] = useState<SavedView[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
	const [activeViewId, setActiveViewId] = useState<string | null>(null);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [tableKey, setTableKey] = useState(0);

	// ダイアログが開いたら親の selectedIds を draft にコピー
	useEffect(() => {
		if (open) {
			setDraftIds(new Set(selectedIds));
		}
	}, [open, selectedIds]);

	const applyView = useCallback((view: SavedView, cols: ApiColumn[]) => {
		let state: ViewState;
		try {
			state = JSON.parse(view.state) as ViewState;
		} catch {
			return;
		}
		setActiveViewId(view.id);
		setSorting(state.sorting ?? []);
		setColumnFilters(state.columnFilters ?? []);

		const knownIds = new Set(state.knownColumnIds ?? []);
		const vis: VisibilityState = {};
		for (const id of FIXED_COLUMN_IDS) {
			vis[id] = knownIds.has(id);
		}
		for (const col of cols) {
			vis[col.id] = knownIds.has(col.id);
		}
		setColumnVisibility(vis);
		setTableKey(k => k + 1);
	}, []);

	// マスターシートデータ + ビューを取得
	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setIsLoading(true);
		setError(null);

		Promise.all([getMastersheetData(), listMastersheetViews()])
			.then(([data, viewsRes]) => {
				if (cancelled) return;
				setApiColumns(data.columns);
				setApiRows(data.rows);
				setViews(viewsRes.views);

				const first = viewsRes.views[0];
				if (first) {
					applyView(first, data.columns);
				}
			})
			.catch(() => {
				if (!cancelled) setError("マスターシートデータの取得に失敗しました。");
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [open, applyView]);

	// テーブルデータ
	const tableData = useMemo(
		(): MastersheetRow[] =>
			apiRows.map(row => ({
				project: row.project,
				cells: Object.fromEntries(row.cells.map(c => [c.columnId, c])),
			})),
		[apiRows]
	);

	// テーブルカラム
	const tableColumns = useMemo(
		() => [...fixedColumns, ...apiColumns.map(buildReadOnlyDynamicColumn)],
		[apiColumns]
	);

	// 初期行選択
	const initialRowSelection = useMemo<RowSelectionState>(() => {
		const state: RowSelectionState = {};
		for (const id of selectedIds) {
			state[id] = true;
		}
		return state;
	}, [selectedIds]);

	const handleRowSelectionChange = useMemo(() => {
		return (rows: MastersheetRow[]) => {
			setDraftIds(new Set(rows.map(r => r.project.id)));
		};
	}, []);

	const handleConfirm = () => {
		onConfirm(draftIds);
		onOpenChange(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="90vw" minHeight="560px">
				<div className={styles.header}>
					<Dialog.Title mb="0">{title}</Dialog.Title>
					<IconButton aria-label="閉じる" onClick={() => onOpenChange(false)}>
						<IconX size={16} />
					</IconButton>
				</div>
				<Dialog.Description size="2" mb="4" color="gray">
					ビューを切り替え、フィルターや検索で企画を絞り込んで選択してください。
				</Dialog.Description>

				{isLoading ? (
					<Text size="2" color="gray">
						読み込み中...
					</Text>
				) : error ? (
					<Text size="2" color="red">
						{error}
					</Text>
				) : (
					<>
						{views.length > 0 && (
							<ReadOnlyViewTabs
								views={views}
								activeViewId={activeViewId}
								onSelectView={view => applyView(view, apiColumns)}
							/>
						)}
						<div className={styles.tableWrapper}>
							<DataTable<MastersheetRow>
								key={tableKey}
								data={tableData}
								columns={tableColumns}
								features={{
									rowSelection: true,
									columnFilter: true,
									globalFilter: true,
									sorting: true,
									columnVisibility: false,
									csvExport: false,
								}}
								getRowId={row => row.project.id}
								initialRowSelection={initialRowSelection}
								initialSorting={sorting}
								initialColumnVisibility={columnVisibility}
								initialColumnFilters={columnFilters}
								onRowSelectionChange={handleRowSelectionChange}
							/>
						</div>
					</>
				)}

				<div className={styles.footer}>
					<Text size="2" color="gray">
						{draftIds.size > 0
							? `${draftIds.size}件選択中`
							: "企画が選択されていません"}
					</Text>
					<div className={styles.footerActions}>
						<Button
							intent="secondary"
							size="2"
							onClick={() => onOpenChange(false)}
						>
							キャンセル
						</Button>
						<Button
							intent="primary"
							size="2"
							onClick={handleConfirm}
							disabled={draftIds.size === 0}
						>
							<IconCheck size={16} />
							確定（{draftIds.size}件）
						</Button>
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
