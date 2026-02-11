import type { Table } from "@tanstack/react-table";

function escapeCsvField(value: unknown): string {
	const str = String(value ?? "");
	if (/[,"\r\n]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export function downloadCsv<T>(table: Table<T>) {
	const headerGroup = table.getHeaderGroups()[0];
	if (!headerGroup) return;

	const headers = headerGroup.headers.map(h =>
		typeof h.column.columnDef.header === "string"
			? h.column.columnDef.header
			: h.column.id
	);

	const rows = table
		.getRowModel()
		.rows.map(row =>
			row.getVisibleCells().map(cell => escapeCsvField(cell.getValue()))
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
