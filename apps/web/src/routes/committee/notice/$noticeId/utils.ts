/**
 * 日時を "2026年03月01日 10:00" 形式にフォーマット
 */
export function formatDateTime(date: Date): string {
	const y = date.getFullYear();
	const m = (date.getMonth() + 1).toString().padStart(2, "0");
	const d = date.getDate().toString().padStart(2, "0");
	const h = date.getHours().toString().padStart(2, "0");
	const min = date.getMinutes().toString().padStart(2, "0");
	return `${y}年${m}月${d}日 ${h}:${min}`;
}
