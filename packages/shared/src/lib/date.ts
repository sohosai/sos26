import { z } from "zod";

/**
 * 雙峰祭2026の日程
 */
export const SOHOSAI_2026_DATES = {
	day1: new Date("2026-11-07"),
	day2: new Date("2026-11-08"),
} as const;

/**
 * 日付をフォーマットする
 */
export function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	return `${year}/${month}/${day}`;
}

/**
 * 雙峰祭期間中かどうかを判定
 */
export function isDuringSohosai(date: Date): boolean {
	const timestamp = date.getTime();
	const day1Start = SOHOSAI_2026_DATES.day1.getTime();
	const day2End = SOHOSAI_2026_DATES.day2.getTime() + 24 * 60 * 60 * 1000;

	if (timestamp >= day1Start && timestamp < day2End) {
		return true;
	} else {
		return false;
	}
}

/**
 * 日付文字列のスキーマ
 */
export const dateStringSchema = z.string().refine(
	val => {
		const date = new Date(val);
		return date.toString() !== "Invalid Date";
	},
	{ message: "有効な日付形式で入力してください" }
);

/**
 * 2つの日付の差分を日数で返す
 */
export function getDaysDifference(date1: Date, date2: Date): number {
	const diff = date1.getTime() - date2.getTime();
	return diff / (1000 * 60 * 60 * 24);
}

/**
 * 雙峰祭までの残り日数を計算
 */
export function getDaysUntilSohosai(): number {
	const now = new Date();
	const sohosaiStart = SOHOSAI_2026_DATES.day1;
	return Math.ceil(getDaysDifference(sohosaiStart, now));
}
