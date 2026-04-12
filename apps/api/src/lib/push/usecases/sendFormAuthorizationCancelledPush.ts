import { z } from "zod";
import { formAuthorizationCancelledTemplate } from "../templates/formAuthorizationCancelled";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	formTitle: z.string().min(1),
	url: z.url(),
});

export async function sendFormAuthorizationCancelledPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, formTitle, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: formAuthorizationCancelledTemplate({ formTitle, url }),
	});
}
