import {
	pushSendRequestSchema,
	pushSendResponseSchema,
	pushSubscribeResponseSchema,
	pushSubscriptionSchema,
} from "../schemas/push";
import type { BodyEndpoint } from "./types";

/**
 * POST /push/subscribe
 */

export const pushSubscribeEndpoint: BodyEndpoint<
	"POST",
	"/push/subscribe",
	undefined,
	undefined,
	typeof pushSubscriptionSchema,
	typeof pushSubscribeResponseSchema
> = {
	method: "POST",
	path: "/push/subscribe",
	pathParams: undefined,
	query: undefined,
	request: pushSubscriptionSchema,
	response: pushSubscribeResponseSchema,
} as const;

/**
 * POST /push/send
 */
export const pushSendEndpoint: BodyEndpoint<
	"POST",
	"/push/send",
	undefined,
	undefined,
	typeof pushSendRequestSchema,
	typeof pushSendResponseSchema
> = {
	method: "POST",
	path: "/push/send",
	pathParams: undefined,
	query: undefined,
	request: pushSendRequestSchema,
	response: pushSendResponseSchema,
} as const;
