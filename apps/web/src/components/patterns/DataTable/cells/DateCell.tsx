import type { CellContext, RowData } from "@tanstack/react-table";
import styles from "./DateCell.module.scss";

function formatDate(date: Date, format: "date" | "datetime"): string {
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

export function DateCell<TData extends RowData>({
	getValue,
	column,
}: CellContext<TData, unknown>) {
	const value = getValue() as Date;
	const dateFormat = column.columnDef.meta?.dateFormat ?? "date";

	return (
		<span className={styles.container}>{formatDate(value, dateFormat)}</span>
	);
}
