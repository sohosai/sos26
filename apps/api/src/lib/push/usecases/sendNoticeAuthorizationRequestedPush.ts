import { z } from "zod";
import { noticeAuthorizationRequestedTemplate } from "../templates/noticeAuthorizationRequested";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	noticeTitle: z.string().min(1),
	url: z.url(),
});

export async function sendNoticeAuthorizationRequestedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, noticeTitle, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: noticeAuthorizationRequestedTemplate({ noticeTitle, url }),
	});
}
