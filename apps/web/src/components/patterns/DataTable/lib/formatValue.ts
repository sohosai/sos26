import type { ColumnMeta, RowData } from "@tanstack/react-table";
import { formatDate, formatProjectNumber } from "@/lib/format";

export { formatDate };

export function stringifyValue(
	value: unknown,
	dateFormat?: "date" | "datetime"
): string {
	if (value == null) return "";
	if (value instanceof Date) return formatDate(value, dateFormat ?? "date");
	if (Array.isArray(value)) {
		return value.map(stringifyObject).join(" , ");
	}
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

function stringifyObject(obj: unknown): string {
	if (obj == null) return "";
	if (typeof obj !== "object") return String(obj);

	// ファイルオブジェクトの場合（fileName を持つ）
	const record = obj as Record<string, unknown>;
	if (record.fileName && typeof record.fileName === "string") {
		return record.fileName;
	} else if (record.label) {
		return String(record.label);
	}
	return String(obj);
}

export function stringifyCellValue(
	value: unknown,
	meta: ColumnMeta<RowData, unknown> | undefined,
	columnId?: string
): string {
	if (value == null) return "";

	// 企画番号カラムの場合、数値をパディング
	if (columnId === "number" && typeof value === "number") {
		return formatProjectNumber(value);
	}

	if (typeof value === "string") {
		return selectLabelFromMeta(value, meta);
	}

	if (Array.isArray(value)) {
		if (meta?.selectOptions) {
			return value
				.map(v =>
					typeof v === "string"
						? selectLabelFromMeta(v, meta)
						: stringifyObject(v)
				)
				.join(" / ");
		}
		return value.map(stringifyObject).join(" , ");
	}

	if (value instanceof Date) {
		return formatDate(value, meta?.dateFormat ?? "date");
	}

	return String(value);
}
