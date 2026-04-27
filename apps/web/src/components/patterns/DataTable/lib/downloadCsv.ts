import type { Table } from "@tanstack/react-table";
import { stringifyCellValue } from "./formatValue";

function escapeCsvField(str: string): string {
	if (/[,"\r\n]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export function downloadCsv<T>(table: Table<T>) {
	const headerGroup = table.getHeaderGroups()[0];
	if (!headerGroup) return;

	const dataHeaders = headerGroup.headers.filter(
		h => h.column.accessorFn != null
	);

	const headers = dataHeaders.map(h =>
		typeof h.column.columnDef.header === "string"
			? h.column.columnDef.header
			: h.column.id
	);

	const rows = table.getRowModel().rows.map(row =>
		row
			.getVisibleCells()
			.filter(cell => cell.column.accessorFn != null)
			.map(cell => {
				const meta = cell.column.columnDef.meta;
				return escapeCsvField(stringifyCellValue(cell.getValue(), meta));
			})
	);

	const csv =
		"\uFEFF" +
		[headers.map(escapeCsvField).join(","), ...rows.map(r => r.join(","))].join(
			"\r\n"
		);

	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "table.csv";
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 10000);
}
