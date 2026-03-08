import { z } from "zod";
import { inquiryAssigneeAddedTemplate } from "../templates/inquiryAssigneeAdded";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	inquiryTitle: z.string().min(1),
	url: z.url(),
});

export async function sendInquiryAssigneeAddedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, inquiryTitle, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: inquiryAssigneeAddedTemplate({ inquiryTitle, url }),
	});
}
