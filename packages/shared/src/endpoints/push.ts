import {
	pushSendRequestSchema,
	pushSendResponseSchema,
	pushSubscribeRequestSchema,
	pushSubscribeResponseSchema,
	pushUnsubscribeRequestSchema,
	pushUnsubscribeResponseSchema,
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
	typeof pushSubscribeRequestSchema,
	typeof pushSubscribeResponseSchema
> = {
	method: "POST",
	path: "/push/subscribe",
	pathParams: undefined,
	query: undefined,
	request: pushSubscribeRequestSchema,
	response: pushSubscribeResponseSchema,
} as const;

/**
 * POST /push/unsubscribe
 */
export const pushUnsubscribeEndpoint: BodyEndpoint<
	"POST",
	"/push/unsubscribe",
	undefined,
	undefined,
	typeof pushUnsubscribeRequestSchema,
	typeof pushUnsubscribeResponseSchema
> = {
	method: "POST",
	path: "/push/unsubscribe",
	pathParams: undefined,
	query: undefined,
	request: pushUnsubscribeRequestSchema,
	response: pushUnsubscribeResponseSchema,
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
