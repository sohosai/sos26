import type { CellContext, RowData } from "@tanstack/react-table";
import { formatDate } from "../lib/formatValue";
import styles from "./DateCell.module.scss";

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
