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
	expirationTime: z.number().nullable().optional(),
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
 * Push通知解除リクエスト
 */
export const pushUnsubscribeRequestSchema = z.object({
	endpoint: z.url(),
});

export type PushUnsubscribeRequest = z.infer<
	typeof pushUnsubscribeRequestSchema
>;

export const pushUnsubscribeResponseSchema = z.object({
	ok: z.boolean(),
});

/**
 * Push通知で送信する payload
 */

const pushActionSchema = z.object({
	action: z.string().min(1),
	title: z.string().min(1),
	icon: z.url().optional(),
});

const pushDataSchema = z.record(z.string(), z.unknown());

export const pushPayloadSchema = z.object({
	title: z.string().min(1),
	body: z.string().optional(),
	icon: z.url().optional(),
	badge: z.url().optional(),
	image: z.url().optional(),
	lang: z.string().optional(),
	tag: z.string().optional(),
	renotify: z.boolean().optional(),
	requireInteraction: z.boolean().optional(),
	silent: z.boolean().optional(),
	timestamp: z.number().int().optional(),
	vibrate: z.array(z.number().int().nonnegative()).optional(),
	actions: z.array(pushActionSchema).max(2).optional(),
	data: pushDataSchema.optional(),
	dir: z.enum(["auto", "ltr", "rtl"]).optional(),
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
