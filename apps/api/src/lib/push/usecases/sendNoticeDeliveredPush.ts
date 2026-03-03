import { z } from "zod";
import { noticeDeliveredTemplate } from "../templates/noticeDelivered";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userIds: z.array(z.string().min(1)),
	noticeTitle: z.string().min(1),
});

export async function sendNoticeDeliveredPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userIds, noticeTitle } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds,
		payload: noticeDeliveredTemplate({ noticeTitle }),
	});
}
