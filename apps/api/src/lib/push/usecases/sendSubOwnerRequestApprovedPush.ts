import { z } from "zod";
import { subOwnerRequestApprovedTemplate } from "../templates/subOwnerRequestApproved";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	projectName: z.string().min(1),
	url: z.url(),
});

export async function sendSubOwnerRequestApprovedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, projectName, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: subOwnerRequestApprovedTemplate({ projectName, url }),
	});
}
