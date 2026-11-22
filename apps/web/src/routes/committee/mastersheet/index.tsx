import { Heading, Text } from "@radix-ui/themes";
import type { GetMastersheetDataResponse } from "@sos26/shared";
import { IconHistory, IconLayoutColumns } from "@tabler/icons-react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import type {
	ColumnFiltersState,
	SortingState,
	VisibilityState,
} from "@tanstack/react-table";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/primitives";
import { getMastersheetData } from "@/lib/api/committee-mastersheet";
import { ColumnPanel } from "./-components/ColumnPanel";
import { HistoryPanel } from "./-components/HistoryPanel";
import {
	MastersheetTable,
	type SelectedCell,
} from "./-components/MastersheetTable";
import { type ViewState, ViewTabs } from "./-components/ViewTabs";
import styles from "./index.module.scss";

const searchSchema = z.object({
	// 公開APIの PUBLIC_API_MASTERSHEET_COLUMN_IDS に設定する列IDを確認するため
	debug: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/committee/mastersheet/")({
	validateSearch: searchSchema,
	// セルの編集は loader のデータに反映しないため、ページを離れたら捨てて次回は取り直す
	gcTime: 0,
	loader: async () => {
		return await getMastersheetData();
	},
	head: () => ({
		meta: [
			{ title: "マスターシート | 雙峰祭オンラインシステム" },
			{ name: "description", content: "マスターシート" },
		],
	}),
	component: MastersheetPage,
});

const FIXED_COLUMN_IDS = [
	"number",
	"name",
	"namePhonetic",
	"type",
	"location",
	"organizationName",
	"organizationNamePhonetic",
	"ownerName",
	"ownerEmail",
	"ownerTelephoneNumber",
	"subOwnerName",
	"subOwnerEmail",
	"subOwnerTelephoneNumber",
	"deletionStatus",
] as const;

const DEFAULT_COLUMN_FILTERS: ColumnFiltersState = [
	{ id: "deletionStatus", value: ["ACTIVE"] },
];
/** デフォルトで非表示にする固定カラム */
const DEFAULT_HIDDEN_FIXED_COLUMNS: Record<string, boolean> = {
	namePhonetic: false,
	organizationNamePhonetic: false,
	ownerEmail: false,
	ownerTelephoneNumber: false,
	subOwnerEmail: false,
	subOwnerTelephoneNumber: false,
};

type MastersheetCell =
	GetMastersheetDataResponse["rows"][number]["cells"][number];
type MastersheetColumn = GetMastersheetDataResponse["columns"][number];

function MastersheetPage() {
	const loaderData = Route.useLoaderData();
	const [data, setData] = useState(loaderData);
	const [prevLoaderData, setPrevLoaderData] = useState(loaderData);
	if (loaderData !== prevLoaderData) {
		setPrevLoaderData(loaderData);
		setData(loaderData);
	}
	const { columns, rows } = data;
	const { debug } = Route.useSearch();
	const router = useRouter();
	const historyPanelRef = useRef<HTMLDivElement>(null);
	const [columnPanelOpen, setColumnPanelOpen] = useState(false);
	const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
	const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
	const [tableKey, setTableKey] = useState(0);
	const [sorting, setSorting] = useState<SortingState | undefined>(undefined);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
		DEFAULT_COLUMN_FILTERS
	);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
		DEFAULT_HIDDEN_FIXED_COLUMNS
	);
	const [activeViewId, setActiveViewId] = useState<string | null>(null);
	const [pinnedColumnIds, setPinnedColumnIds] = useState<string[]>([]);

	async function handleColumnSuccess() {
		await router.invalidate();
	}

	async function reloadData() {
		try {
			setData(await getMastersheetData());
		} catch {
			toast.error(
				"最新のデータを取得できませんでした。ページを再読み込みしてください"
			);
		}
	}

	/** cell が undefined のときはセルを取り除く */
	function handleCellChange(
		projectId: string,
		columnId: string,
		cell: MastersheetCell | undefined
	) {
		setData(prev => ({
			...prev,
			rows: prev.rows.map(row => {
				if (row.project.id !== projectId) return row;
				const others = row.cells.filter(c => c.columnId !== columnId);
				return { ...row, cells: cell ? [...others, cell] : others };
			}),
		}));
	}

	function handleColumnUpdated(column: MastersheetColumn) {
		// 削除された選択肢はセルの値からも消える
		const optionIds = new Set(column.options.map(o => o.id));
		const filterOptions = (value: MastersheetCell["cellValue"]) =>
			value && {
				...value,
				selectedOptionIds: value.selectedOptionIds.filter(id =>
					optionIds.has(id)
				),
			};
		setData(prev => ({
			columns: prev.columns.map(c => (c.id === column.id ? column : c)),
			rows:
				column.type === "CUSTOM"
					? prev.rows.map(row => ({
							...row,
							cells: row.cells.map(c =>
								c.columnId === column.id
									? { ...c, cellValue: filterOptions(c.cellValue) }
									: c
							),
						}))
					: prev.rows,
		}));
	}

	function handleColumnDeleted(columnId: string) {
		setData(prev => ({
			columns: prev.columns.filter(c => c.id !== columnId),
			rows: prev.rows.map(row => ({
				...row,
				cells: row.cells.filter(c => c.columnId !== columnId),
			})),
		}));
		setPinnedColumnIds(prev => prev.filter(id => id !== columnId));
	}

	function handleSortingChange(newSorting: SortingState) {
		setSorting(newSorting);
	}

	function handleColumnVisibilityChange(visibility: VisibilityState) {
		setColumnVisibility(visibility);
	}

	function handleToggleColumn(columnId: string, visible: boolean) {
		const next = { ...columnVisibility, [columnId]: visible };
		setColumnVisibility(next);
		if (!visible) {
			setPinnedColumnIds(prev => prev.filter(id => id !== columnId));
		}
		setTableKey(k => k + 1);
	}

	function handleTogglePinColumn(columnId: string, pinned: boolean) {
		setPinnedColumnIds(prev => {
			if (pinned) {
				if (prev.includes(columnId)) return prev;
				return [...prev, columnId];
			}
			return prev.filter(id => id !== columnId);
		});
		setTableKey(k => k + 1);
	}

	function handleSelectView(viewId: string, viewState: ViewState) {
		setActiveViewId(viewId);
		setSorting(viewState.sorting);

		const knownIds = new Set(viewState.knownColumnIds ?? []);
		const completeVisibility: VisibilityState = {};
		// 固定カラム：knownColumnIds に従う
		for (const id of FIXED_COLUMN_IDS) {
			completeVisibility[id] = knownIds.has(id);
		}
		// 動的カラム：knownColumnIds に含まれていれば表示、なければ非表示
		for (const col of columns) {
			completeVisibility[col.id] = knownIds.has(col.id);
		}
		setColumnVisibility(completeVisibility);
		setColumnFilters(viewState.columnFilters ?? DEFAULT_COLUMN_FILTERS);

		const visibleIdSet = new Set(
			(Object.entries(completeVisibility) as [string, boolean][])
				.filter(([, v]) => v !== false)
				.map(([id]) => id)
		);
		setPinnedColumnIds(
			(viewState.pinnedColumnIds ?? []).filter(id => visibleIdSet.has(id))
		);
		setTableKey(k => k + 1);
	}

	function handleActiveViewIdChange(viewId: string) {
		setActiveViewId(viewId);
	}

	const toolbarExtra = (
		<>
			<Button
				intent="secondary"
				onClick={() => setHistoryPanelOpen(prev => !prev)}
			>
				<IconHistory size={16} /> 履歴
			</Button>
			<Button intent="secondary" onClick={() => setColumnPanelOpen(true)}>
				<IconLayoutColumns size={16} /> カラム編集
			</Button>
		</>
	);

	return (
		<div>
			<div style={{ marginBottom: 8 }}>
				<Heading size="6">マスターシート</Heading>
				<Text size="2" color="gray">
					企画データの一覧・編集ができます。
				</Text>
			</div>
			<ViewTabs
				activeViewId={activeViewId}
				currentState={{
					sorting,
					columnFilters,
					knownColumnIds: [
						...FIXED_COLUMN_IDS.filter(id => columnVisibility[id] !== false),
						...columns
							.filter(c => columnVisibility[c.id] !== false)
							.map(c => c.id),
					],
					pinnedColumnIds: pinnedColumnIds.filter(
						id => columnVisibility[id] !== false
					),
				}}
				onSelectView={handleSelectView}
				onActiveViewIdChange={handleActiveViewIdChange}
			/>
			<div className={styles.layout}>
				<div className={styles.tableWrapper}>
					<MastersheetTable
						key={tableKey}
						columns={columns}
						rows={rows}
						initialSorting={sorting}
						initialColumnVisibility={columnVisibility}
						initialColumnFilters={columnFilters}
						pinnedColumnIds={pinnedColumnIds}
						onSortingChange={handleSortingChange}
						onColumnVisibilityChange={handleColumnVisibilityChange}
						onColumnFiltersChange={setColumnFilters}
						toolbarExtra={toolbarExtra}
						onSelectionChange={setSelectedCells}
						onCellChange={handleCellChange}
						onReload={reloadData}
						showColumnIds={debug === true}
						selectionIgnoreRef={historyPanelRef}
					/>
				</div>
				<HistoryPanel
					ref={historyPanelRef}
					open={historyPanelOpen}
					onClose={() => setHistoryPanelOpen(false)}
					columns={columns}
					rows={rows}
					selectedCells={selectedCells}
				/>
			</div>
			<ColumnPanel
				open={columnPanelOpen}
				onOpenChange={setColumnPanelOpen}
				columns={columns}
				columnVisibility={columnVisibility}
				pinnedColumnIds={pinnedColumnIds}
				onToggleColumn={handleToggleColumn}
				onTogglePinColumn={handleTogglePinColumn}
				onSuccess={handleColumnSuccess}
				onColumnUpdated={handleColumnUpdated}
				onColumnDeleted={handleColumnDeleted}
			/>
		</div>
	);
}
