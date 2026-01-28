import type { PushPayload, PushSubscription } from "@sos26/shared";
import { webpush } from "./client";

export async function sendPush(
	subscription: PushSubscription,
	payload: PushPayload
) {
	return webpush.sendNotification(subscription, JSON.stringify(payload));
}
