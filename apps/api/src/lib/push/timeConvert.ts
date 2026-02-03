/**
 * PushSubscription が持つ expirationTime（DOMHighResTimeStamp）を
 * Prisma の DateTime カラムに保存できる Date 型へ変換する。
 *
 * expirationTime は「ページロードからの相対ミリ秒」
 *
 * @param expirationTime Push API から受け取る DOMHighResTimeStamp（ms）
 * @returns 失効時刻を表す Date。未提供の場合は null
 */
export function convertExpirationTime(
	expirationTime?: number | null
): Date | null {
	if (!expirationTime) {
		return null;
	}

	return new Date(Date.now() + expirationTime);
}
