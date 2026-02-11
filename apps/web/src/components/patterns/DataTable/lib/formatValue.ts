export function formatDate(date: Date, format: "date" | "datetime"): string {
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

export function stringifyValue(
	value: unknown,
	dateFormat?: "date" | "datetime"
): string {
	if (value == null) return "";
	if (value instanceof Date) return formatDate(value, dateFormat ?? "date");
	if (Array.isArray(value)) return value.join(" / ");
	return String(value);
}
