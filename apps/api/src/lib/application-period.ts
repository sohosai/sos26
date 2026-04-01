import { env } from "./env";
import { Errors } from "./error";

/**
 * 企画応募期間内かどうかをチェック
 * @param now チェックする日時（省略時は現在時刻）
 * @throws {Error} 応募期間外の場合
 */
export function assertWithinApplicationPeriod(now: Date = new Date()): void {
	const periods = env.PROJECT_APPLICATION_PERIODS;

	// 未設定の場合は無期限（常に許可）
	if (!periods) {
		return;
	}

	// いずれかの期間内であればOK
	const isWithinPeriod = periods.some(
		({ start, end }) => now >= start && now <= end
	);

	if (!isWithinPeriod) {
		throw Errors.invalidRequest("現在は企画応募期間外です");
	}
}

/**
 * 企画応募期間内かどうかを判定
 * @param now チェックする日時（省略時は現在時刻）
 * @returns 期間内であればtrue
 */
export function isWithinApplicationPeriod(now: Date = new Date()): boolean {
	const periods = env.PROJECT_APPLICATION_PERIODS;

	if (!periods) {
		return true;
	}

	return periods.some(({ start, end }) => now >= start && now <= end);
}

/**
 * 企画応募期間の情報を取得
 * @returns 期間情報（無期限の場合はnull、それ以外は期間の配列とisOpenフラグ）
 */
export function getApplicationPeriodInfo(now: Date = new Date()): {
	isOpen: boolean;
	periods: { start: string; end: string }[] | null;
} {
	const periods = env.PROJECT_APPLICATION_PERIODS;

	if (!periods) {
		return {
			isOpen: true,
			periods: null,
		};
	}

	const isOpen = periods.some(({ start, end }) => now >= start && now <= end);

	return {
		isOpen,
		periods: periods.map(({ start, end }) => ({
			start: start.toISOString(),
			end: end.toISOString(),
		})),
	};
}
