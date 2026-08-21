/**
 * 公開API（/openapi）のキャッシュ無効化用のバージョン番号。
 *
 * 公開API は無認証で叩けるため一定時間キャッシュしているが、
 * 開店状態や在庫状態は即時に反映されてほしい。
 * 企画の公開情報が更新されたらこのバージョンを進め、キャッシュを捨てさせる。
 */
let version = 0;

/** 公開APIのキャッシュを無効化する */
export function bumpPublicApiCacheVersion(): void {
	version += 1;
}

/** 現在のキャッシュバージョンを返す */
export function getPublicApiCacheVersion(): number {
	return version;
}
