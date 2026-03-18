import type { PushSubscription, PushUnsubscribeRequest } from "@sos26/shared";
import { pushSubscribeEndpoint, pushUnsubscribeEndpoint } from "@sos26/shared";
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
	let unsubscribeError: unknown = null;

	try {
		await subscription.unsubscribe();
	} catch (error) {
		unsubscribeError = error;
	}

	await callBodyApi(pushUnsubscribeEndpoint, {
		endpoint,
	} satisfies PushUnsubscribeRequest);

	if (unsubscribeError) {
		throw unsubscribeError;
	}
}
