import type { PushPayload, PushSubscription } from "@sos26/shared";
import { pushSendEndpoint, pushSubscribeEndpoint } from "@sos26/shared";
import { env } from "../env";
import { callBodyApi } from "./core";

/**
 * Push通知を有効化
 */
export async function enablePush(): Promise<void> {
	const registration = await navigator.serviceWorker.register("/sw.js");

	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: env.VITE_VAPID_PUBLIC_KEY,
	});

	const json = subscription.toJSON();

	await callBodyApi(pushSubscribeEndpoint, json as PushSubscription);
}

export async function sendPush(param: PushPayload): Promise<void> {
	await callBodyApi(pushSendEndpoint, param);
}
