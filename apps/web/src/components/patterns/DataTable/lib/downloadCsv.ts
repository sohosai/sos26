import type { Table } from "@tanstack/react-table";

function formatDateForCsv(date: Date, format: "date" | "datetime"): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");

	if (format === "datetime") {
		const h = String(date.getHours()).padStart(2, "0");
		const min = String(date.getMinutes()).padStart(2, "0");
		return `${y}/${m}/${d} ${h}:${min}`;
	}

	return `${y}/${m}/${d}`;
}

function stringifyValue(
	value: unknown,
	dateFormat?: "date" | "datetime"
): string {
	if (value == null) return "";
	if (value instanceof Date)
		return formatDateForCsv(value, dateFormat ?? "date");
	if (Array.isArray(value)) return value.join(" / ");
	return String(value);
}

function escapeCsvField(str: string): string {
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

	const rows = table.getRowModel().rows.map(row =>
		row.getVisibleCells().map(cell => {
			const dateFormat = cell.column.columnDef.meta?.dateFormat;
			return escapeCsvField(stringifyValue(cell.getValue(), dateFormat));
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
