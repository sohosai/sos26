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

export function formatProjectNumber(projectNumber: number): string {
	return String(projectNumber).padStart(3, "0");
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type RelativeUnit = "day" | "week" | "month" | "year" | "auto";

export function formatRelativeTime(
	date: Date,
	unit: RelativeUnit = "auto"
): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	function plural(n: number, singular: string, suffix = "前") {
		return `${n}${singular}${suffix}`;
	}
	if (diffDays <= 0) return "今日";

	if (unit === "day") return plural(diffDays, "日");
	if (unit === "week")
		return plural(Math.max(1, Math.floor(diffDays / 7)), "週間");
	if (unit === "month")
		return plural(Math.max(1, Math.floor(diffDays / 30)), "か月");
	if (unit === "year")
		return plural(Math.max(1, Math.floor(diffDays / 365)), "年");

	// auto
	if (diffDays < 7) return plural(diffDays, "日");
	if (diffDays < 30)
		return plural(Math.max(1, Math.floor(diffDays / 7)), "週間");
	if (diffDays < 365)
		return plural(Math.max(1, Math.floor(diffDays / 30)), "か月");
	return plural(Math.max(1, Math.floor(diffDays / 365)), "年");
}
