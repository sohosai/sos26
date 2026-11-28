import {
	Box,
	Flex,
	Popover,
	Checkbox as RadixCheckbox,
	Table,
	TextField,
} from "@radix-ui/themes";
import {
	IconDownload,
	IconFilterOff,
	IconSearch,
	IconSettings,
} from "@tabler/icons-react";
import {
	type Cell,
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type Header,
	type Table as ReactTable,
	type Row,
	type RowData,
	type RowSelectionState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	type CSSProperties,
	memo,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Button, Checkbox } from "@/components/primitives";
import { ColumnFilterPopover } from "./ColumnFilterPopover";
import styles from "./DataTable.module.scss";
import { useCopyToClipboard } from "./hooks/useCopyToClipboard";
import { useSelection } from "./hooks/useSelection";
import { downloadCsv } from "./lib/downloadCsv";
import { stringifyValue } from "./lib/formatValue";

export type DataTableFeatures = {
	sorting?: boolean;
	globalFilter?: boolean;
	columnVisibility?: boolean;
	selection?: boolean;
	copy?: boolean;
	csvExport?: boolean;
	/** カラムごとのフィルター（columnDef.meta.filterVariant で種別指定） */
	columnFilter?: boolean;
	/** 行チェックボックス選択（selection を自動無効化） */
	rowSelection?: boolean;
};

const defaultFeatures: Required<DataTableFeatures> = {
	sorting: true,
	globalFilter: true,
	columnVisibility: true,
	selection: true,
	copy: true,
	csvExport: true,
	columnFilter: false,
	rowSelection: false,
};

type DataTableProps<T> = {
	data: T[];
	// biome-ignore lint/suspicious/noExplicitAny: TanStack Table requires any for mixed column value types
	columns: ColumnDef<T, any>[];
	/** 左固定するカラムID（表示順は元の columns 順に従い、固定カラムを左側に寄せる） */
	pinnedColumnIds?: string[];
	features?: DataTableFeatures;
	csvFileName?: string;
	initialSorting?: SortingState;
	initialGlobalFilter?: string;
	initialColumnVisibility?: VisibilityState;
	initialColumnFilters?: ColumnFiltersState;
	onCellEdit?: (row: T, columnId: string, value: unknown) => void;
	/** ツールバーに追加する任意の要素（ボタンなど） */
	toolbarExtra?: ReactNode;
	/** CSV出力ボタンの左側に表示する任意の要素 */
	toolbarExtraBeforeCsv?: ReactNode;
	/** ソート変化を通知 */
	onSortingChange?: (sorting: SortingState) => void;
	/** カラム表示変化を通知 */
	onColumnVisibilityChange?: (visibility: VisibilityState) => void;
	/** カラムフィルター変化を通知 */
	onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
	/** rowSelection=true のとき行選択変化を通知 */
	onRowSelectionChange?: (rows: T[]) => void;
	/** rowSelection=true のとき行IDを返す関数（デフォルト: 行インデックス） */
	getRowId?: (row: T, index: number) => string;
	/** rowSelection=true のとき初期選択状態（getRowId で返る ID をキーとする） */
	initialRowSelection?: RowSelectionState;
	/** セル選択変化を通知（選択されたセルの row/col インデックスペア） */
	onSelectionChange?: (selected: { row: T; columnId: string }[]) => void;
	/** テーブル外クリックで選択解除する際に除外する要素の ref */
	selectionIgnoreRef?: React.RefObject<HTMLElement | null>;
};

// ─── カスタムフィルター関数 ───────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table's FilterFn requires generic RowData
const formattedGlobalFilter: FilterFn<any> = (row, columnId, filterValue) => {
	const value = row.getValue(columnId);
	const meta = row.getAllCells().find(c => c.column.id === columnId)?.column
		.columnDef.meta;
	const str = stringifyValue(value, meta?.dateFormat ?? "datetime");
	return str.toLowerCase().includes(String(filterValue).toLowerCase());
};

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table's FilterFn requires generic RowData
const numberRangeFilterFn: FilterFn<any> = (
	row,
	columnId,
	value: { min: string; max: string }
) => {
	const num = row.getValue<number | null | undefined>(columnId);
	if (num == null) return false;
	if (value.min && num < Number(value.min)) return false;
	if (value.max && num > Number(value.max)) return false;
	return true;
};
numberRangeFilterFn.autoRemove = (val: { min: string; max: string }) =>
	!val?.min && !val?.max;

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table's FilterFn requires generic RowData
const multiValueFilterFn: FilterFn<any> = (row, columnId, value: string[]) => {
	if (!value || value.length === 0) return true;
	const cellVal = row.getValue<unknown>(columnId);
	if (Array.isArray(cellVal)) {
		return (cellVal as string[]).some(v => value.includes(v));
	}
	return value.includes(String(cellVal ?? ""));
};
multiValueFilterFn.autoRemove = (val: string[]) => !val?.length;

/** これより行が多い表だけ、画面に見えている行とその前後だけを描画する */
const VIRTUALIZE_ROW_THRESHOLD = 100;
/** 行の高さの見積もり（Radix Table の size 2 のセルの最小の高さ）。描画したあとは実際の高さで測り直す */
const ESTIMATED_ROW_HEIGHT = 44;

const sortIndicator: Record<string, string> = {
	asc: " ↑",
	desc: " ↓",
	none: " ↑↓",
};

/** 初回マウント後にのみ変化を callback へ通知するフック */
function useChangeCallback<T>(
	value: T,
	callback: ((v: T) => void) | undefined
): void {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;
	const isMountedRef = useRef(false);

	useEffect(() => {
		if (!isMountedRef.current) return;
		callbackRef.current?.(value);
	}, [value]);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);
}

function hasToolbar(
	f: Required<DataTableFeatures>,
	extra: ReactNode,
	extraBeforeCsv: ReactNode
): boolean {
	return !!(
		f.globalFilter ||
		f.columnVisibility ||
		f.csvExport ||
		extra ||
		extraBeforeCsv
	);
}

type PinnedCellStyle = {
	isPinned: boolean;
	left?: number;
	className?: string;
	style?: CSSProperties;
};

function getPinnedCellStyle(
	columnId: string,
	effectivePinnedSet: ReadonlySet<string>,
	pinnedLeft: Record<string, number>,
	lastPinnedId: string | undefined,
	kind: "header" | "body"
): PinnedCellStyle {
	const isPinned = effectivePinnedSet.has(columnId);
	if (!isPinned) return { isPinned };

	const left = pinnedLeft[columnId] ?? 0;
	const baseClass =
		kind === "header" ? styles.pinnedHeaderCell : styles.pinnedBodyCell;
	const className = `${baseClass}${
		columnId === lastPinnedId ? ` ${styles.pinnedLast}` : ""
	}`;
	// 見出しを上に固定した表でも、ピン留めした見出しがほかの見出しより上に来るようにする
	const zIndex = kind === "header" ? 4 : 2;
	return {
		isPinned,
		left,
		className,
		style: { left, position: "sticky", zIndex },
	};
}

function isSamePinnedLeft(
	a: Record<string, number>,
	b: Record<string, number>
): boolean {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) return false;
	for (const k of aKeys) {
		if (a[k] !== b[k]) return false;
	}
	return true;
}

function buildOrderedColumns<T extends RowData>(
	columns: ColumnDef<T, unknown>[],
	pinnedColumnIds: string[] | undefined,
	pinnedSet: ReadonlySet<string>
): ColumnDef<T, unknown>[] {
	if (!pinnedColumnIds?.length) return columns;
	const pinned: ColumnDef<T, unknown>[] = [];
	const rest: ColumnDef<T, unknown>[] = [];
	for (const col of columns) {
		const id = (col as { id?: string }).id;
		if (id && pinnedSet.has(id)) pinned.push(col);
		else rest.push(col);
	}
	return [...pinned, ...rest];
}

function buildTableColumns<T extends RowData>(
	orderedColumns: ColumnDef<T, unknown>[],
	features: Pick<Required<DataTableFeatures>, "columnFilter" | "rowSelection">
): ColumnDef<T, unknown>[] {
	const augmented: ColumnDef<T, unknown>[] = features.columnFilter
		? orderedColumns.map(col => {
				const variant = (col as { meta?: { filterVariant?: string } }).meta
					?.filterVariant;
				if (variant === "number")
					return { ...col, filterFn: numberRangeFilterFn };
				if (variant === "select")
					return { ...col, filterFn: multiValueFilterFn };
				return col;
			})
		: orderedColumns;

	if (!features.rowSelection) return augmented;

	const selectCol: ColumnDef<T, unknown> = {
		id: "_select",
		enableSorting: false,
		enableHiding: false,
		enableColumnFilter: false,
		header: ({ table }) => (
			<RadixCheckbox
				size="1"
				aria-label="全行を選択"
				checked={table.getIsAllRowsSelected()}
				onCheckedChange={val => table.toggleAllRowsSelected(!!val)}
			/>
		),
		cell: ({ row }) => (
			<RadixCheckbox
				size="1"
				aria-label="この行を選択"
				checked={row.getIsSelected()}
				onCheckedChange={val => row.toggleSelected(!!val)}
				disabled={!row.getCanSelect()}
			/>
		),
	};
	return [selectCol, ...augmented];
}

function renderHeaderCell<T extends RowData>(args: {
	header: Header<T, unknown>;
	effectivePinnedSet: ReadonlySet<string>;
	pinnedLeft: Record<string, number>;
	lastPinnedId: string | undefined;
	features: Required<DataTableFeatures>;
}): ReactNode {
	const { header, effectivePinnedSet, pinnedLeft, lastPinnedId, features } =
		args;
	const columnId = header.column.id;
	const pinned = getPinnedCellStyle(
		columnId,
		effectivePinnedSet,
		pinnedLeft,
		lastPinnedId,
		"header"
	);

	const canSort = header.column.getCanSort();
	const onClick = canSort ? header.column.getToggleSortingHandler() : undefined;
	const cursor = canSort ? "pointer" : "default";
	const sortKey = (header.column.getIsSorted() || "none") as string;
	const showFilter =
		features.columnFilter && !!header.column.columnDef.meta?.filterVariant;

	return (
		<Table.ColumnHeaderCell
			key={header.id}
			data-column-id={columnId}
			className={pinned.className}
			style={{
				whiteSpace: "nowrap",
				...(pinned.style ?? {}),
			}}
		>
			<Flex align="center" gap="1">
				<Flex
					align="center"
					gap="1"
					flexGrow="1"
					onClick={onClick}
					style={{ cursor, userSelect: "none" }}
				>
					{header.isPlaceholder
						? null
						: flexRender(header.column.columnDef.header, header.getContext())}
					{canSort && sortIndicator[sortKey]}
				</Flex>
				{showFilter && <ColumnFilterPopover column={header.column} />}
			</Flex>
		</Table.ColumnHeaderCell>
	);
}

function renderBodyCell<T extends RowData>(args: {
	cell: Cell<T, unknown>;
	rowIndex: number;
	cellIndex: number;
	effectivePinnedSet: ReadonlySet<string>;
	pinnedLeft: Record<string, number>;
	lastPinnedId: string | undefined;
	cellSelection: boolean;
	isCellSelected: boolean;
	handleCellMouseDown: (ri: number, ci: number, e: ReactMouseEvent) => void;
	handleCellMouseEnter: (ri: number, ci: number) => void;
}): ReactNode {
	const {
		cell,
		rowIndex,
		cellIndex,
		effectivePinnedSet,
		pinnedLeft,
		lastPinnedId,
		cellSelection,
		isCellSelected,
		handleCellMouseDown,
		handleCellMouseEnter,
	} = args;

	const columnId = cell.column.id;
	const pinned = getPinnedCellStyle(
		columnId,
		effectivePinnedSet,
		pinnedLeft,
		lastPinnedId,
		"body"
	);
	const selectedClass =
		cellSelection && isCellSelected ? ` ${styles.cellSelected}` : "";
	const className = `${pinned.className ?? ""}${selectedClass}`.trim();

	return (
		<Table.Cell
			key={cell.id}
			className={className || undefined}
			style={{
				whiteSpace: "nowrap",
				...(pinned.style ?? {}),
			}}
			onMouseDown={
				cellSelection
					? e => handleCellMouseDown(rowIndex, cellIndex, e)
					: undefined
			}
			onMouseEnter={
				cellSelection
					? () => handleCellMouseEnter(rowIndex, cellIndex)
					: undefined
			}
		>
			{flexRender(cell.column.columnDef.cell, cell.getContext())}
		</Table.Cell>
	);
}

type DataTableRowProps<T extends RowData> = {
	row: Row<T>;
	rowIndex: number;
	/** この行で選択中の列番号を「,1,3,」の形でつないだもの。変わった行だけを描画し直すために文字列で渡す */
	selectedCellIndexes: string;
	/** 行チェックボックスの状態。row が同じままでも変わるので、描画し直すために渡す */
	isRowSelected: boolean;
	/** カラム定義と表示カラム。変わったら描画し直すために渡す（中では使わない） */
	columns: unknown;
	columnVisibility: VisibilityState;
	effectivePinnedSet: ReadonlySet<string>;
	pinnedLeft: Record<string, number>;
	lastPinnedId: string | undefined;
	cellSelection: boolean;
	handleCellMouseDown: (ri: number, ci: number, e: ReactMouseEvent) => void;
	handleCellMouseEnter: (ri: number, ci: number) => void;
	measureElement: ((el: Element | null) => void) | undefined;
};

function DataTableRowImpl<T extends RowData>(props: DataTableRowProps<T>) {
	const { row, rowIndex, selectedCellIndexes, measureElement } = props;
	return (
		<Table.Row ref={measureElement} data-index={rowIndex}>
			{row.getVisibleCells().map((cell, ci) =>
				renderBodyCell({
					cell,
					rowIndex,
					cellIndex: ci,
					effectivePinnedSet: props.effectivePinnedSet,
					pinnedLeft: props.pinnedLeft,
					lastPinnedId: props.lastPinnedId,
					cellSelection: props.cellSelection,
					isCellSelected: selectedCellIndexes.includes(`,${ci},`),
					handleCellMouseDown: props.handleCellMouseDown,
					handleCellMouseEnter: props.handleCellMouseEnter,
				})
			)}
		</Table.Row>
	);
}

// ドラッグで選択が変わるたびに、選択の変わった行だけを描画し直す
const DataTableRow = memo(DataTableRowImpl) as typeof DataTableRowImpl;

/**
 * Radix の Table は table を ScrollArea で包むので、表の中のスクロールはその Viewport で起きる。
 * 見出しやピン留めした列の sticky もこの要素が基準になる
 */
function getTableViewport(container: HTMLElement | null): HTMLElement | null {
	return (
		container?.querySelector<HTMLElement>(".rt-ScrollAreaViewport") ?? null
	);
}

/**
 * 行が多い表では、表自身のスクロール領域で見えている行と、その前後だけを返す。
 * 表の外側のスクロールに合わせると、レイアウトやスクロール位置の復元に左右されるため、表の中でスクロールさせる
 */
function useRowVirtualizer<T extends RowData>(
	rows: Row<T>[],
	scrollContainerRef: React.RefObject<HTMLDivElement | null>
) {
	const virtualize = rows.length > VIRTUALIZE_ROW_THRESHOLD;
	const tbodyRef = useRef<HTMLTableSectionElement>(null);
	// スクロール領域の中での表の本体の位置（見出しの高さ）
	const [scrollMargin, setScrollMargin] = useState(0);
	useLayoutEffect(() => {
		const viewport = getTableViewport(scrollContainerRef.current);
		if (!virtualize || !viewport || !tbodyRef.current) return;
		const top =
			tbodyRef.current.getBoundingClientRect().top -
			viewport.getBoundingClientRect().top -
			viewport.clientTop +
			viewport.scrollTop;
		setScrollMargin(prev => (prev === top ? prev : top));
	});
	// 並べ替えで行の位置が変わっても、測った高さを行に結びつけておく。
	// 描画のたびに作り直すと、全行の位置の計算がやり直されるので、行が変わったときだけ作る
	const getItemKey = useCallback(
		(index: number) => rows[index]?.id ?? index,
		[rows]
	);
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => getTableViewport(scrollContainerRef.current),
		estimateSize: () => ESTIMATED_ROW_HEIGHT,
		getItemKey,
		overscan: 10,
		scrollMargin,
		enabled: virtualize,
	});

	if (!virtualize) {
		return {
			virtualize,
			tbodyRef,
			renderedRows: rows.map((row, index) => ({ row, index })),
			paddingTop: 0,
			paddingBottom: 0,
			measureElement: virtualizer.measureElement,
			firstRenderedIndex: 0,
			lastRenderedIndex: rows.length - 1,
		};
	}
	const items = virtualizer.getVirtualItems();
	const first = items[0];
	const last = items.at(-1);
	return {
		virtualize,
		tbodyRef,
		renderedRows: items.flatMap(item => {
			const row = rows[item.index];
			return row ? [{ row, index: item.index }] : [];
		}),
		paddingTop: first ? first.start - scrollMargin : 0,
		paddingBottom: last
			? virtualizer.getTotalSize() - (last.end - scrollMargin)
			: 0,
		measureElement: virtualizer.measureElement,
		firstRenderedIndex: first?.index ?? 0,
		lastRenderedIndex: last?.index ?? -1,
	};
}

/** 選択中のセルを、行番号ごとに「,1,3,」の形の列番号にまとめる */
function groupSelectedCellIndexes(selected: ReadonlySet<string>) {
	const byRow = new Map<number, string>();
	for (const cellId of selected) {
		const [rowStr, colStr] = cellId.split(":");
		const ri = Number(rowStr);
		byRow.set(ri, `${byRow.get(ri) ?? ","}${colStr},`);
	}
	return byRow;
}

/** 仮想化で描画しない行の分の高さを埋める */
function SpacerRow({ height, colSpan }: { height: number; colSpan: number }) {
	if (height <= 0) return null;
	return (
		<tr>
			<td colSpan={colSpan} style={{ height, padding: 0, border: 0 }} />
		</tr>
	);
}

function DataTableToolbar<T extends RowData>(props: {
	show: boolean;
	features: Required<DataTableFeatures>;
	table: ReactTable<T>;
	csvFileName?: string;
	globalFilter: string;
	setGlobalFilter: (v: string) => void;
	columnFilters: ColumnFiltersState;
	setColumnFilters: (v: ColumnFiltersState) => void;
	toolbarExtra: ReactNode;
	toolbarExtraBeforeCsv: ReactNode;
}): ReactNode {
	const {
		show,
		features,
		table,
		csvFileName,
		globalFilter,
		setGlobalFilter,
		columnFilters,
		setColumnFilters,
		toolbarExtra,
		toolbarExtraBeforeCsv,
	} = props;

	if (!show) return null;

	return (
		<Flex gap="3" mb="3" align="end" className={styles.toolbar}>
			{features.globalFilter && (
				<Box maxWidth="300px" flexGrow="1" className={styles.searchBox}>
					<TextField.Root
						placeholder="検索..."
						value={globalFilter}
						onChange={e => setGlobalFilter(e.target.value)}
					>
						<TextField.Slot>
							<IconSearch size={16} />
						</TextField.Slot>
					</TextField.Root>
				</Box>
			)}
			<Box flexGrow="1" className={styles.toolbarSpacer} />
			{features.columnVisibility && (
				<Popover.Root>
					<Popover.Trigger>
						<Button intent="secondary">
							<IconSettings size={16} /> 表示カラム
						</Button>
					</Popover.Trigger>
					<Popover.Content>
						<Flex direction="column" gap="2">
							{table
								.getAllColumns()
								.filter(column => column.getCanHide())
								.map(column => (
									<Checkbox
										key={column.id}
										label={
											typeof column.columnDef.header === "string"
												? column.columnDef.header
												: column.id
										}
										size="1"
										checked={column.getIsVisible()}
										onCheckedChange={value => column.toggleVisibility(!!value)}
									/>
								))}
						</Flex>
					</Popover.Content>
				</Popover.Root>
			)}
			{features.columnFilter && columnFilters.length > 0 && (
				<Button intent="secondary" onClick={() => setColumnFilters([])}>
					<IconFilterOff size={16} /> フィルター解除
				</Button>
			)}
			{toolbarExtraBeforeCsv}
			{features.csvExport && (
				<Button
					intent="secondary"
					onClick={() => downloadCsv(table, csvFileName)}
				>
					<IconDownload size={16} /> CSV出力
				</Button>
			)}
			{toolbarExtra}
		</Flex>
	);
}

export function DataTable<T extends RowData>({
	data,
	columns,
	csvFileName = "table",
	pinnedColumnIds,
	features: featuresProp,
	initialSorting = [],
	initialGlobalFilter = "",
	initialColumnVisibility = {} as VisibilityState,
	initialColumnFilters = [],
	onCellEdit,
	toolbarExtra,
	toolbarExtraBeforeCsv,
	onSortingChange,
	onColumnVisibilityChange,
	onColumnFiltersChange,
	onRowSelectionChange,
	getRowId,
	initialRowSelection = {},
	onSelectionChange,
	selectionIgnoreRef,
}: DataTableProps<T>) {
	const f = { ...defaultFeatures, ...featuresProp };

	// rowSelection=true のとき cell selection を無効化
	const cellSelection = f.rowSelection ? false : f.selection;

	const [sorting, setSorting] = useState<SortingState>(initialSorting);
	const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
		initialColumnVisibility
	);
	const [columnFilters, setColumnFilters] =
		useState<ColumnFiltersState>(initialColumnFilters);
	const [rowSelection, setRowSelection] =
		useState<RowSelectionState>(initialRowSelection);
	const tableRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	const pinnedSet = useMemo(
		() => new Set<string>(pinnedColumnIds ?? []),
		[pinnedColumnIds]
	);
	const effectivePinnedSet = useMemo(() => {
		const next = new Set(pinnedSet);
		if (f.rowSelection) next.add("_select");
		return next;
	}, [pinnedSet, f.rowSelection]);
	const [pinnedLeft, setPinnedLeft] = useState<Record<string, number>>({});

	const {
		selected,
		isDragging,
		clearSelection,
		handleCellMouseDown,
		handleCellMouseEnter,
		handleMouseUp,
	} = useSelection();

	const orderedColumns = useMemo(() => {
		return buildOrderedColumns(
			columns as ColumnDef<T, unknown>[],
			pinnedColumnIds,
			pinnedSet
		);
	}, [columns, pinnedColumnIds, pinnedSet]);

	// カラムにフィルター関数を付与 + rowSelection 用チェックボックスカラムを先頭に追加
	const tableColumns = useMemo(() => {
		return buildTableColumns(orderedColumns, {
			columnFilter: f.columnFilter,
			rowSelection: f.rowSelection,
		});
	}, [orderedColumns, f.columnFilter, f.rowSelection]);

	const table = useReactTable({
		data,
		columns: tableColumns,
		state: {
			sorting,
			globalFilter,
			columnVisibility,
			columnFilters,
			rowSelection,
		},
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		onColumnVisibilityChange: setColumnVisibility,
		onColumnFiltersChange: setColumnFilters,
		onRowSelectionChange: setRowSelection,
		enableRowSelection: f.rowSelection,
		getRowId: getRowId ? (row, idx) => getRowId(row, idx) : undefined,
		getCoreRowModel: getCoreRowModel(),
		globalFilterFn: formattedGlobalFilter,
		getFilteredRowModel:
			f.globalFilter || f.columnFilter ? getFilteredRowModel() : undefined,
		getSortedRowModel: f.sorting ? getSortedRowModel() : undefined,
		filterFns: {
			numberRange: numberRangeFilterFn,
			multiValue: multiValueFilterFn,
		},
		meta: {
			updateData: (row: T, columnId: string, value: unknown) => {
				onCellEdit?.(row, columnId, value);
			},
			clearSelection: cellSelection ? clearSelection : undefined,
		},
	});

	// 行選択変化を親に通知
	const onRowSelectionChangeRef = useRef(onRowSelectionChange);
	onRowSelectionChangeRef.current = onRowSelectionChange;
	// biome-ignore lint/correctness/useExhaustiveDependencies: rowSelection triggers the update
	useEffect(() => {
		if (onRowSelectionChangeRef.current) {
			const rows = table.getSelectedRowModel().rows.map(r => r.original);
			onRowSelectionChangeRef.current(rows);
		}
	}, [rowSelection]);

	// ソート・カラム表示変化を親に通知（初回マウント時はスキップ）
	useChangeCallback(sorting, onSortingChange);
	useChangeCallback(columnVisibility, onColumnVisibilityChange);
	useChangeCallback(columnFilters, onColumnFiltersChange);

	// セル選択変化を親に通知する。ドラッグ中は通知せず、mouseup のあとに 1 回だけ通知する
	const onSelectionChangeRef = useRef(onSelectionChange);
	onSelectionChangeRef.current = onSelectionChange;
	// biome-ignore lint/correctness/useExhaustiveDependencies: selected triggers the callback
	useEffect(() => {
		if (!onSelectionChangeRef.current || !cellSelection || isDragging) return;
		const rows = table.getRowModel().rows;
		const visibleColumns = table.getVisibleFlatColumns();
		const items: { row: T; columnId: string }[] = [];
		for (const cellId of selected) {
			const [rowStr, colStr] = cellId.split(":");
			const ri = Number(rowStr);
			const ci = Number(colStr);
			const row = rows[ri];
			const col = visibleColumns[ci];
			if (row && col) {
				items.push({ row: row.original, columnId: col.id });
			}
		}
		onSelectionChangeRef.current(items);
	}, [selected, cellSelection, isDragging]);

	useCopyToClipboard(table, selected, cellSelection && f.copy);

	// biome-ignore lint/correctness/useExhaustiveDependencies: sorting/globalFilter/columnVisibility/columnFilters are intentional triggers
	useEffect(() => {
		if (cellSelection) clearSelection();
	}, [
		sorting,
		globalFilter,
		columnVisibility,
		columnFilters,
		clearSelection,
		cellSelection,
	]);

	useEffect(() => {
		if (!cellSelection) return;
		document.addEventListener("mouseup", handleMouseUp);
		return () => document.removeEventListener("mouseup", handleMouseUp);
	}, [handleMouseUp, cellSelection]);

	useEffect(() => {
		if (!cellSelection) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") clearSelection();
		};
		const ignoreRef = selectionIgnoreRef;
		const handleOutsideClick = (e: MouseEvent) => {
			const target = e.target as Node;
			if (tableRef.current && !tableRef.current.contains(target)) {
				if (ignoreRef?.current?.contains(target)) {
					return;
				}
				clearSelection();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("mousedown", handleOutsideClick);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("mousedown", handleOutsideClick);
		};
	}, [clearSelection, cellSelection, selectionIgnoreRef]);

	const showToolbar = hasToolbar(f, toolbarExtra, toolbarExtraBeforeCsv);

	const {
		virtualize,
		tbodyRef,
		renderedRows,
		paddingTop,
		paddingBottom,
		measureElement,
		firstRenderedIndex,
		lastRenderedIndex,
	} = useRowVirtualizer(table.getRowModel().rows, scrollContainerRef);
	const selectedCellIndexesByRow = groupSelectedCellIndexes(selected);
	const visibleColumnCount = table.getVisibleLeafColumns().length;

	const pinnedVisibleColumns = useMemo(() => {
		if (!pinnedColumnIds?.length && !f.rowSelection) return [];
		return table
			.getVisibleLeafColumns()
			.filter(c => effectivePinnedSet.has(c.id));
	}, [pinnedColumnIds, f.rowSelection, effectivePinnedSet, table]);
	const lastPinnedId = pinnedVisibleColumns.at(-1)?.id;

	// 仮想化すると描画する行が変わり、列の幅も変わりうるので、描画する範囲が変わったら測り直す
	// biome-ignore lint/correctness/useExhaustiveDependencies: firstRenderedIndex and lastRenderedIndex are intentional triggers
	useLayoutEffect(() => {
		if (!pinnedColumnIds?.length && !f.rowSelection) {
			setPinnedLeft({});
			return;
		}

		const next: Record<string, number> = {};
		let left = 0;
		for (const col of pinnedVisibleColumns) {
			next[col.id] = left;
			const el = tableRef.current?.querySelector<HTMLTableCellElement>(
				`th[data-column-id="${col.id}"]`
			);
			const w = el?.getBoundingClientRect().width ?? 0;
			left += w;
		}
		setPinnedLeft(prev => (isSamePinnedLeft(prev, next) ? prev : next));
	}, [
		pinnedColumnIds,
		f.rowSelection,
		pinnedVisibleColumns,
		firstRenderedIndex,
		lastRenderedIndex,
	]);

	return (
		<Box ref={tableRef}>
			{DataTableToolbar({
				show: showToolbar,
				features: f,
				table,
				csvFileName,
				globalFilter,
				setGlobalFilter,
				columnFilters,
				setColumnFilters,
				toolbarExtra,
				toolbarExtraBeforeCsv,
			})}
			<div
				ref={scrollContainerRef}
				className={`${styles.scrollContainer}${virtualize ? ` ${styles.virtualized}` : ""}`}
			>
				<Table.Root
					variant="surface"
					className={`${styles.root}${cellSelection && isDragging ? ` ${styles.selecting}` : ""}`}
				>
					<Table.Header>
						{table.getHeaderGroups().map(headerGroup => (
							<Table.Row key={headerGroup.id}>
								{headerGroup.headers.map(header =>
									renderHeaderCell({
										header,
										effectivePinnedSet,
										pinnedLeft,
										lastPinnedId,
										features: f,
									})
								)}
							</Table.Row>
						))}
					</Table.Header>
					<Table.Body ref={tbodyRef}>
						<SpacerRow height={paddingTop} colSpan={visibleColumnCount} />
						{renderedRows.map(({ row, index }) => (
							<DataTableRow
								key={row.id}
								row={row}
								rowIndex={index}
								selectedCellIndexes={selectedCellIndexesByRow.get(index) ?? ""}
								isRowSelected={row.getIsSelected()}
								columns={tableColumns}
								columnVisibility={columnVisibility}
								effectivePinnedSet={effectivePinnedSet}
								pinnedLeft={pinnedLeft}
								lastPinnedId={lastPinnedId}
								cellSelection={cellSelection}
								handleCellMouseDown={handleCellMouseDown}
								handleCellMouseEnter={handleCellMouseEnter}
								measureElement={virtualize ? measureElement : undefined}
							/>
						))}
						<SpacerRow height={paddingBottom} colSpan={visibleColumnCount} />
					</Table.Body>
				</Table.Root>
			</div>
		</Box>
	);
}
