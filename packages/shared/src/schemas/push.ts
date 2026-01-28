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
	endpoint: z.string().url(),
	expirationTime: z.number().nullable().optional(),
	keys: pushSubscriptionKeysSchema,
});

export type PushSubscription = z.infer<typeof pushSubscriptionSchema>;

/**
 * Push通知で送信する payload
 */
export const pushPayloadSchema = z.object({
	title: z.string().min(1),
	body: z.string().optional(),
});

export type PushPayload = z.infer<typeof pushPayloadSchema>;
