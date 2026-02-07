import webpush from "web-push";
import { env } from "../env";

/**
 * Push Service（FCM / APNs / Autopush）と通信するための
 * web-push クライアントの初期化状態を管理するフラグ。
 */
let initialized = false;

/**
 * Push 通知用インフラの初期化処理。
 *
 * - VAPID 公開鍵 / 秘密鍵を web-push に設定する
 * - アプリ起動時に1回だけ呼ばれることを想定
 */
export function initPush() {
	if (initialized) return;

	webpush.setVapidDetails(
		`mailto:${env.ADMIN_MAIL}`,
		env.VAPID_PUBLIC_KEY,
		env.VAPID_PRIVATE_KEY
	);

	initialized = true;
}

/**
 * 初期化済みの web-push クライアント。
 *
 * - 直接 Route から使わず、sender / service 経由で利用する想定
 * - 実装ライブラリ（web-push）を infra レイヤーに閉じ込めるため export する
 */
export { webpush };
