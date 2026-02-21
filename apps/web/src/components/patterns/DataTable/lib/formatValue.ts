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
