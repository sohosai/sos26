import { z } from "zod";

/**
 * PushSubscription.keys
 */
export const pushSubscriptionKeysSchema = z.object({
	p256dh: z.string(),
	auth: z.string(),
});

/**
 * PushSubscription
 */
export const pushSubscriptionSchema = z.object({
	endpoint: z.url(),
	// Push API: Unix エポックからの絶対ミリ秒（DOMHighResTimeStamp）
	expirationTime: z.coerce.date().nullable().optional(),
	keys: pushSubscriptionKeysSchema,
});

export type PushSubscription = z.infer<typeof pushSubscriptionSchema>;

/**
 * Push通知登録リクエスト
 */
export const pushSubscribeRequestSchema = z.object({
	subscription: pushSubscriptionSchema,
});

export type PushSubscribeRequest = z.infer<typeof pushSubscribeRequestSchema>;

export const pushSubscribeResponseSchema = z.object({
	ok: z.boolean(),
});

/**
 * Push通知で送信する payload
 */
export const pushPayloadSchema = z.object({
	title: z.string().min(1),
	body: z.string().optional(),
});

/**
 * Push通知送信リクエスト
 */
export const pushSendRequestSchema = z.object({
	// 送信するユーザーのユーザーIDの配列
	users: z.array(z.string()),
	payload: pushPayloadSchema,
});

export type PushSendRequest = z.infer<typeof pushSendRequestSchema>;

/**
 * Push通知送信レスポンス
 */
export const pushSendResponseSchema = z.object({
	ok: z.boolean(),
});

export type PushPayload = z.infer<typeof pushPayloadSchema>;
