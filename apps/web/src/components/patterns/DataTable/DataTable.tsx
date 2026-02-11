import { Box, Flex, Popover, Table, Text, TextField } from "@radix-ui/themes";
import { IconDownload, IconSearch, IconSettings } from "@tabler/icons-react";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type RowData,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import { Button, Checkbox } from "@/components/primitives";
import styles from "./DataTable.module.scss";
import { useCopyToClipboard } from "./hooks/useCopyToClipboard";
import { useSelection } from "./hooks/useSelection";
import { downloadCsv } from "./lib/downloadCsv";

export type DataTableFeatures = {
	sorting?: boolean;
	globalFilter?: boolean;
	columnVisibility?: boolean;
	selection?: boolean;
	copy?: boolean;
	csvExport?: boolean;
};

const defaultFeatures: Required<DataTableFeatures> = {
	sorting: true,
	globalFilter: true,
	columnVisibility: true,
	selection: true,
	copy: true,
	csvExport: true,
};

type DataTableProps<T> = {
	data: T[];
	// biome-ignore lint/suspicious/noExplicitAny: TanStack Table requires any for mixed column value types
	columns: ColumnDef<T, any>[];
	features?: DataTableFeatures;
	initialSorting?: SortingState;
	initialGlobalFilter?: string;
	onCellEdit?: (rowIndex: number, columnId: string, value: unknown) => void;
};

const sortIndicator: Record<string, string> = {
	asc: " ↑",
	desc: " ↓",
	none: " ↑↓",
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: feature-flag branching is inherently complex but straightforward
export function DataTable<T extends RowData>({
	data,
	columns,
	features: featuresProp,
	initialSorting = [],
	initialGlobalFilter = "",
	onCellEdit,
}: DataTableProps<T>) {
	const f = { ...defaultFeatures, ...featuresProp };

	const [sorting, setSorting] = useState<SortingState>(initialSorting);
	const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
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

	const table = useReactTable({
		data,
		columns,
		state: {
			...(f.sorting ? { sorting } : {}),
			...(f.globalFilter ? { globalFilter } : {}),
			...(f.columnVisibility ? { columnVisibility } : {}),
		},
		...(f.sorting ? { onSortingChange: setSorting } : {}),
		...(f.globalFilter ? { onGlobalFilterChange: setGlobalFilter } : {}),
		...(f.columnVisibility
			? { onColumnVisibilityChange: setColumnVisibility }
			: {}),
		getCoreRowModel: getCoreRowModel(),
		...(f.globalFilter ? { getFilteredRowModel: getFilteredRowModel() } : {}),
		...(f.sorting ? { getSortedRowModel: getSortedRowModel() } : {}),
		meta: {
			updateData: (rowIndex: number, columnId: string, value: unknown) => {
				onCellEdit?.(rowIndex, columnId, value);
			},
			clearSelection: f.selection ? clearSelection : undefined,
		},
	});

	useCopyToClipboard(table, selected, f.selection && f.copy);

	// Clear selection when sort order or filter changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: sorting/globalFilter/columnVisibility are intentional triggers
	useEffect(() => {
		if (f.selection) clearSelection();
	}, [sorting, globalFilter, columnVisibility, clearSelection, f.selection]);

	// Global mouseup to end drag
	useEffect(() => {
		if (!f.selection) return;
		document.addEventListener("mouseup", handleMouseUp);
		return () => document.removeEventListener("mouseup", handleMouseUp);
	}, [handleMouseUp, f.selection]);

	// Escape to clear selection + click outside table to clear
	useEffect(() => {
		if (!f.selection) return;
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
	}, [clearSelection, f.selection]);

	return (
		<>
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
			</Flex>
			<Table.Root
				ref={tableRef}
				variant="surface"
				className={`${styles.root}${f.selection && isDragging ? ` ${styles.selecting}` : ""}`}
				style={{ overflowX: "auto" }}
			>
				<Table.Header>
					{table.getHeaderGroups().map(headerGroup => (
						<Table.Row key={headerGroup.id}>
							{headerGroup.headers.map(header => (
								<Table.ColumnHeaderCell
									key={header.id}
									onClick={
										f.sorting
											? header.column.getToggleSortingHandler()
											: undefined
									}
									style={{
										cursor: f.sorting ? "pointer" : "default",
										userSelect: "none",
										whiteSpace: "nowrap",
									}}
								>
									{header.isPlaceholder
										? null
										: flexRender(
												header.column.columnDef.header,
												header.getContext()
											)}
									{f.sorting &&
										sortIndicator[
											(header.column.getIsSorted() || "none") as string
										]}
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
										f.selection && isSelected(ri, ci)
											? styles.cellSelected
											: undefined
									}
									style={{ whiteSpace: "nowrap" }}
									onMouseDown={
										f.selection
											? e => handleCellMouseDown(ri, ci, e)
											: undefined
									}
									onMouseEnter={
										f.selection ? () => handleCellMouseEnter(ri, ci) : undefined
									}
								>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</Table.Cell>
							))}
						</Table.Row>
					))}
				</Table.Body>
			</Table.Root>
			{f.selection && selected.size > 0 && (
				<Box
					mt="3"
					p="3"
					style={{
						background: "var(--gray-a3)",
						borderRadius: "var(--radius-2)",
					}}
				>
					<Text size="2" weight="bold">
						選択中: {selected.size}セル
					</Text>
					<Text size="1" color="gray" ml="2" as="span">
						{" "}
						[ {[...selected].sort().join(", ")} ]
					</Text>
				</Box>
			)}
		</>
	);
}
