import {
	pushSendRequestSchema,
	pushSubscribeRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { env } from "../lib/env";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { sendPush } from "../lib/push/send";
import { requireAuth } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";
export const pushRoute = new Hono<AuthEnv>();

pushRoute.post("/subscribe", requireAuth, async c => {
	const body = await c.req.json().catch(() => {
		throw Errors.invalidRequest("JSON の形式が不正です");
	});
	const parsedBody = pushSubscribeRequestSchema.parse(body);
	const subscription = parsedBody.subscription;
	const userId = c.get("user").id;
	// expirationTime は Unix エポックからの絶対ミリ秒（EpochTimeStamp）
	const expiresAt = subscription.expirationTime
		? new Date(subscription.expirationTime)
		: null;

	try {
		await prisma.$transaction(async tx => {
			const pushSub = await tx.pushSubscription.upsert({
				where: {
					endpoint: subscription.endpoint,
				},
				update: {
					p256dh: subscription.keys.p256dh,
					auth: subscription.keys.auth,
					expiresAt: expiresAt,
				},
				create: {
					endpoint: subscription.endpoint,
					p256dh: subscription.keys.p256dh,
					auth: subscription.keys.auth,
					expiresAt: expiresAt,
				},
			});

			await tx.userPushSubscription.upsert({
				where: {
					userId_pushSubscriptionId: {
						userId,
						pushSubscriptionId: pushSub.id,
					},
				},
				update: {},
				create: {
					userId,
					pushSubscriptionId: pushSub.id,
				},
			});
		});
	} catch (e) {
		console.error("PushSubscription の保存に失敗しました:", e);
		throw Errors.internal("PushSubscription の保存に失敗しました");
	}

	return c.json({ ok: true });
});

pushRoute.post("/send", async c => {
	const body = await c.req.json().catch(() => {
		throw Errors.invalidRequest("JSON の形式が不正です");
	});
	const parsedBody = pushSendRequestSchema.parse(body);
	const users = parsedBody.users;
	const payload = parsedBody.payload;

	if (users.length === 0) {
		console.warn("Push送信対象ユーザーが0件のためスキップ");
		return c.json({ ok: true });
	}

	const subscriptions = await prisma.pushSubscription.findMany({
		where: {
			deletedAt: null,
			users: { some: { userId: { in: users } } },
		},
	});

	if (subscriptions.length === 0) {
		console.warn("有効なPushSubscriptionが0件のためスキップ");
		return c.json({ ok: true });
	}

	// 無効なIDを集める用
	const inactiveIds: string[] = [];
	// リソースの節約のためバッチに分けて送信
	const batchSize: number = env.PUSH_SEND_BATCH_SIZE;

	for (let i = 0; i < subscriptions.length; i += batchSize) {
		const batch = subscriptions.slice(i, i + batchSize);
		await Promise.all(
			batch.map(async sub => {
				try {
					await sendPush(
						{
							endpoint: sub.endpoint,
							keys: { p256dh: sub.p256dh, auth: sub.auth },
						},
						payload
					);
				} catch (e: unknown) {
					console.error("Push通知の送信に失敗しました:", e);
					const status: number | undefined = getStatusCodeFromWebpush(e);
					const now = new Date();

					// 404 または 410 はサブスクリプションが無効になっている可能性が高いため、DB上でも無効化する
					if (status === 404 || status === 410) {
						console.warn("PushSubscription が無効のため無効化");
						inactiveIds.push(sub.id);
					} else if (sub.expiresAt && sub.expiresAt < now) {
						console.warn("PushSubscription の有効期限が切れているため無効化");
						inactiveIds.push(sub.id);
					}
				}
			})
		);
	}

	if (inactiveIds.length > 0) {
		try {
			const now = new Date();
			await prisma.pushSubscription.updateMany({
				where: { id: { in: inactiveIds } },
				data: { deletedAt: now },
			});
		} catch (e) {
			console.error("PushSubscriptionの無効化に失敗しました:", e);
		}
	}

	return c.json({ ok: true });
});

function getStatusCodeFromWebpush(error: unknown): number | undefined {
	if (
		error !== null &&
		typeof error === "object" &&
		"statusCode" in error &&
		typeof error.statusCode === "number"
	) {
		return error.statusCode;
	}
	return undefined;
}
