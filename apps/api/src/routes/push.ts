import type { PushSubscription, pushSendRequest } from "@sos26/shared";
import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { sendPush } from "../lib/push/send";
import { convertExpirationTime } from "../lib/push/timeConvert";
export const pushRoute = new Hono();

pushRoute.post("/push/subscribe", async c => {
	const subscription: PushSubscription | null =
		await c.req.json<PushSubscription>();

	const userId = "";

	await prisma.pushSubscription.upsert({
		where: {
			endpoint: subscription.endpoint,
		},
		update: {
			p256dh: subscription.keys.p256dh,
			auth: subscription.keys.auth,
			isActive: true,
			expiresAt: convertExpirationTime(subscription.expirationTime),
		},
		create: {
			userId,
			endpoint: subscription.endpoint,
			p256dh: subscription.keys.p256dh,
			auth: subscription.keys.auth,
			expiresAt: convertExpirationTime(subscription.expirationTime),
		},
	});

	return c.json({ ok: true });
});

pushRoute.post("/push/send", async c => {
	const body = await c.req.json<pushSendRequest>();

	const { users, payload } = body;

	if (users.length === 0) {
		return c.json({ ok: true });
	}

	const subscriptions = await prisma.pushSubscription.findMany({
		where: {
			userId: { in: users },
			isActive: true,
		},
	});

	if (subscriptions.length === 0) {
		return c.json({ ok: true });
	}

	// 同時に送信
	await Promise.all(
		subscriptions.map(async sub => {
			try {
				await sendPush(
					{
						endpoint: sub.endpoint,
						keys: { p256dh: sub.p256dh, auth: sub.auth },
					},
					payload
				);
			} catch (_err) {
				return c.json({ _err });
				// 失敗したものは無効化する？（期限切れ・削除済みなど）
				// await prisma.pushSubscription.update({
				// 	where: { id: sub.id },
				// 	data: { isActive: false },
				// });
			}
		})
	);

	return c.json({ ok: true });
});
