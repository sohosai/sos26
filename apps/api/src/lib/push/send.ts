import { SpanStatusCode } from "@opentelemetry/api";
import type { PushPayload, PushSubscription } from "@sos26/shared";
import { tracer } from "../../otel";
import { webpush } from "./client";

/**
 * Push通知を送信
 *
 * @param subscription PushSubscription
 * @param payload
 */
export async function sendPush(
	subscription: PushSubscription,
	payload: PushPayload
) {
	// OTEL-003: Web Push 送信を計装する。呼び出し側の成功/失敗ハンドリング
	// （無効な購読の削除等）は変更しない。
	return tracer.startActiveSpan("webpush.sendNotification", async span => {
		try {
			return await webpush.sendNotification(
				subscription,
				JSON.stringify(payload)
			);
		} catch (e) {
			span.recordException(e as Error);
			span.setStatus({ code: SpanStatusCode.ERROR });
			throw e;
		} finally {
			span.end();
		}
	});
}
