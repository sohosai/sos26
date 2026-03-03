import { z } from "zod";
import { inquiryCommentAddedTemplate } from "../templates/inquiryCommentAdded";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userIds: z.array(z.string().min(1)),
	inquiryTitle: z.string().min(1),
	url: z.url(),
});

export async function sendInquiryCommentAddedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userIds, inquiryTitle, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds,
		payload: inquiryCommentAddedTemplate({ inquiryTitle, url }),
	});
}
