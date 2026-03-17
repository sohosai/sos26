import { z } from "zod";
import { subOwnerRequestRejectedTemplate } from "../templates/subOwnerRequestRejected";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	projectName: z.string().min(1),
	url: z.url(),
});

export async function sendSubOwnerRequestRejectedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, projectName, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: subOwnerRequestRejectedTemplate({ projectName, url }),
	});
}
