import { z } from "zod";
import { subOwnerRequestSentTemplate } from "../templates/subOwnerRequestSent";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	projectName: z.string().min(1),
	url: z.url(),
});

export async function sendSubOwnerRequestSentPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, projectName, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: subOwnerRequestSentTemplate({ projectName, url }),
	});
}
