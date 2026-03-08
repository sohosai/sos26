import type { PushPayload } from "@sos26/shared";
import { env } from "../../env";
import { prisma } from "../../prisma";
import { sendPush } from "../send";

export async function sendPushToUsers(input: {
	userIds: string[];
	payload: PushPayload;
}): Promise<void> {
	if (input.userIds.length === 0) {
		return;
	}

	const subscriptions = await prisma.pushSubscription.findMany({
		where: {
			deletedAt: null,
			users: { some: { userId: { in: input.userIds } } },
		},
	});

	if (subscriptions.length === 0) {
		return;
	}

	const inactiveIds: string[] = [];
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
						input.payload
					);
				} catch (e: unknown) {
					console.error("Push通知の送信に失敗しました:", e);
					const status: number | undefined = getStatusCodeFromWebpush(e);
					const now = new Date();

					if (status === 404 || status === 410) {
						inactiveIds.push(sub.id);
					} else if (sub.expiresAt && sub.expiresAt < now) {
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
}

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
