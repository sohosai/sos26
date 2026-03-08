import { z } from "zod";
import { accessRequestReceivedTemplate } from "../templates/accessRequestReceived";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	columnName: z.string().min(1),
	url: z.url(),
});

export async function sendAccessRequestReceivedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, columnName, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: accessRequestReceivedTemplate({ columnName, url }),
	});
}
