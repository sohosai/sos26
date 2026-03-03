import type {
	PushSendRequest,
	PushSubscription,
	PushUnsubscribeRequest,
} from "@sos26/shared";
import {
	pushSendEndpoint,
	pushSubscribeEndpoint,
	pushUnsubscribeEndpoint,
} from "@sos26/shared";
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

	await callBodyApi(pushSubscribeEndpoint, {
		subscription: json as PushSubscription,
	});
}

/**
 * Push通知を無効化
 */
export async function disablePush(): Promise<void> {
	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.getSubscription();
	if (!subscription) {
		return;
	}

	const endpoint = subscription.endpoint;
	await subscription.unsubscribe();
	await callBodyApi(pushUnsubscribeEndpoint, {
		endpoint,
	} satisfies PushUnsubscribeRequest);
}

/**
 * Push通知を送信
 */
export async function sendPush(param: PushSendRequest): Promise<void> {
	await callBodyApi(pushSendEndpoint, param);
}
