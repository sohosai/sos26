import { z } from "zod";
import { noticeAuthorizationDecidedTemplate } from "../templates/noticeAuthorizationDecided";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	noticeTitle: z.string().min(1),
	status: z.enum(["APPROVED", "REJECTED"]),
});

export async function sendNoticeAuthorizationDecidedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, noticeTitle, status } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: noticeAuthorizationDecidedTemplate({ noticeTitle, status }),
	});
}
