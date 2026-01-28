import type { PushSubscription } from "@sos26/shared";
import { Hono } from "hono";
import { sendPush } from "../infra/push/send";
export const pushRoute = new Hono();

// pushSubscriptionをメモリに保存（開発用）
let subscription: PushSubscription | null = null;

pushRoute.post("/push/subscribe", async c => {
	subscription = await c.req.json<PushSubscription>();
	return c.json({ ok: true });
});

pushRoute.post("/push/send", async c => {
	if (!subscription) {
		return c.json({ error: "no subscription" }, 400);
	}
	const payload = await c.req.json();

	await sendPush(subscription, payload);

	return c.json({ ok: true });
});
