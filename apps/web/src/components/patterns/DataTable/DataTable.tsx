import {
	Box,
	Flex,
	Popover,
	Checkbox as RadixCheckbox,
	Table,
	Text,
	TextField,
} from "@radix-ui/themes";
import { IconDownload, IconSearch, IconSettings } from "@tabler/icons-react";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type RowData,
	type RowSelectionState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
	features?: DataTableFeatures;
	initialSorting?: SortingState;
	initialGlobalFilter?: string;
	initialColumnVisibility?: VisibilityState;
	onCellEdit?: (row: T, columnId: string, value: unknown) => void;
	/** ツールバーに追加する任意の要素（ボタンなど） */
	toolbarExtra?: ReactNode;
	/** ソート変化を通知 */
	onSortingChange?: (sorting: SortingState) => void;
	/** カラム表示変化を通知 */
	onColumnVisibilityChange?: (visibility: VisibilityState) => void;
	/** rowSelection=true のとき行選択変化を通知 */
	onRowSelectionChange?: (rows: T[]) => void;
	/** rowSelection=true のとき行IDを返す関数（デフォルト: 行インデックス） */
	getRowId?: (row: T, index: number) => string;
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

function hasToolbar(f: Required<DataTableFeatures>, extra: ReactNode): boolean {
	return !!(f.globalFilter || f.columnVisibility || f.csvExport || extra);
}

export function DataTable<T extends RowData>({
	data,
	columns,
	features: featuresProp,
	initialSorting = [],
	initialGlobalFilter = "",
	initialColumnVisibility = {} as VisibilityState,
	onCellEdit,
	toolbarExtra,
	onSortingChange,
	onColumnVisibilityChange,
	onRowSelectionChange,
	getRowId,
}: DataTableProps<T>) {
	const f = { ...defaultFeatures, ...featuresProp };
	// rowSelection=true のとき cell selection を無効化
	const cellSelection = f.rowSelection ? false : f.selection;

	const [sorting, setSorting] = useState<SortingState>(initialSorting);
	const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
		initialColumnVisibility
	);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const tableRef = useRef<HTMLDivElement>(null);

	const {
		selected,
		isDragging,
		isSelected,
		clearSelection,
		handleCellMouseDown,
		handleCellMouseEnter,
		handleMouseUp,
	} = useSelection();

	// カラムにフィルター関数を付与 + rowSelection 用チェックボックスカラムを先頭に追加
	const tableColumns = useMemo(() => {
		const augmented: ColumnDef<T, unknown>[] = f.columnFilter
			? columns.map(col => {
					const variant = (col as { meta?: { filterVariant?: string } }).meta
						?.filterVariant;
					if (variant === "number")
						return { ...col, filterFn: numberRangeFilterFn };
					if (variant === "select")
						return { ...col, filterFn: multiValueFilterFn };
					return col;
				})
			: columns;

		if (!f.rowSelection) return augmented;

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
	}, [columns, f.columnFilter, f.rowSelection]);

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
		const handleOutsideClick = (e: MouseEvent) => {
			if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
				clearSelection();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("mousedown", handleOutsideClick);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("mousedown", handleOutsideClick);
		};
	}, [clearSelection, cellSelection]);

	const showToolbar = hasToolbar(f, toolbarExtra);

	const selectedRowCount = Object.keys(rowSelection).length;

	return (
		<Box>
			{showToolbar && (
				<Flex gap="3" mb="3" align="end">
					{f.globalFilter && (
						<Box maxWidth="300px" flexGrow="1">
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
					<Box flexGrow="1" />
					{f.columnVisibility && (
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
												onCheckedChange={value =>
													column.toggleVisibility(!!value)
												}
											/>
										))}
								</Flex>
							</Popover.Content>
						</Popover.Root>
					)}
					{f.csvExport && (
						<Button intent="secondary" onClick={() => downloadCsv(table)}>
							<IconDownload size={16} /> CSV出力
						</Button>
					)}
					{toolbarExtra}
				</Flex>
			)}
			<Table.Root
				ref={tableRef}
				variant="surface"
				className={`${styles.root}${cellSelection && isDragging ? ` ${styles.selecting}` : ""}`}
				style={{ overflowX: "auto" }}
			>
				<Table.Header>
					{table.getHeaderGroups().map(headerGroup => (
						<Table.Row key={headerGroup.id}>
							{headerGroup.headers.map(header => (
								<Table.ColumnHeaderCell
									key={header.id}
									style={{ whiteSpace: "nowrap" }}
								>
									<Flex align="center" gap="1">
										<Flex
											align="center"
											gap="1"
											flexGrow="1"
											onClick={
												header.column.getCanSort()
													? header.column.getToggleSortingHandler()
													: undefined
											}
											style={{
												cursor: header.column.getCanSort()
													? "pointer"
													: "default",
												userSelect: "none",
											}}
										>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext()
													)}
											{header.column.getCanSort() &&
												sortIndicator[
													(header.column.getIsSorted() || "none") as string
												]}
										</Flex>
										{f.columnFilter &&
											header.column.columnDef.meta?.filterVariant && (
												<ColumnFilterPopover column={header.column} />
											)}
									</Flex>
								</Table.ColumnHeaderCell>
							))}
						</Table.Row>
					))}
				</Table.Header>
				<Table.Body>
					{table.getRowModel().rows.map((row, ri) => (
						<Table.Row key={row.id}>
							{row.getVisibleCells().map((cell, ci) => (
								<Table.Cell
									key={cell.id}
									className={
										cellSelection && isSelected(ri, ci)
											? styles.cellSelected
											: undefined
									}
									style={{ whiteSpace: "nowrap" }}
									onMouseDown={
										cellSelection
											? e => handleCellMouseDown(ri, ci, e)
											: undefined
									}
									onMouseEnter={
										cellSelection
											? () => handleCellMouseEnter(ri, ci)
											: undefined
									}
								>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</Table.Cell>
							))}
						</Table.Row>
					))}
				</Table.Body>
			</Table.Root>
			{cellSelection && selected.size > 0 && (
				<Box mt="3" p="3" className={styles.selectionInfo}>
					<Text size="2" weight="bold">
						選択中: {selected.size}セル
					</Text>
					<Text size="1" color="gray" ml="2" as="span">
						{" "}
						[ {[...selected].sort().join(", ")} ]
					</Text>
				</Box>
			)}
			{f.rowSelection && selectedRowCount > 0 && (
				<Box mt="3" p="3" className={styles.selectionInfo}>
					<Text size="2" weight="bold">
						{selectedRowCount}件を選択中
					</Text>
				</Box>
			)}
		</Box>
	);
}
