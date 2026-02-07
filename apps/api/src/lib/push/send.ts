import type { PushPayload, PushSubscription } from "@sos26/shared";
import { webpush } from "./client";

/**
 * Push通知を送信
 *
 * @param subscription PushSubscription
 * @param payload
 */
export async function sendPush(
	subscription: PushSubscription,
	payload: PushPayload
) {
	return webpush.sendNotification(subscription, JSON.stringify(payload));
}
