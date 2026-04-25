import type { ColumnMeta, RowData } from "@tanstack/react-table";
import { formatDate } from "@/lib/format";

export { formatDate };

export function stringifyValue(
	value: unknown,
	dateFormat?: "date" | "datetime"
): string {
	if (value == null) return "";
	if (value instanceof Date) return formatDate(value, dateFormat ?? "date");
	if (Array.isArray(value)) return value.join(" / ");
	return String(value);
}

function selectLabelFromMeta(
	value: string,
	meta: ColumnMeta<RowData, unknown> | undefined
): string {
	const options = meta?.selectOptions;
	if (!options) return value;
	return options.find(o => o.value === value)?.label ?? value;
}

export function stringifyCellValue(
	value: unknown,
	meta: ColumnMeta<RowData, unknown> | undefined
): string {
	if (value == null) return "";

	if (typeof value === "string") {
		return selectLabelFromMeta(value, meta);
	}

	if (Array.isArray(value)) {
		if (meta?.selectOptions) {
			return value
				.map(v =>
					typeof v === "string" ? selectLabelFromMeta(v, meta) : String(v)
				)
				.join(" / ");
		}
		return value.join(" / ");
	}

	if (value instanceof Date) {
		return formatDate(value, meta?.dateFormat ?? "date");
	}

	return String(value);
}
