import { z } from "zod";
import { noticeAuthorizationCancelledTemplate } from "../templates/noticeAuthorizationCancelled";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	noticeTitle: z.string().min(1),
	url: z.url(),
});

export async function sendNoticeAuthorizationCancelledPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, noticeTitle, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: noticeAuthorizationCancelledTemplate({ noticeTitle, url }),
	});
}
