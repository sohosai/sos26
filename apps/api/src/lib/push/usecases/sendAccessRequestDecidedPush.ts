import { z } from "zod";
import { accessRequestDecidedTemplate } from "../templates/accessRequestDecided";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	columnName: z.string().min(1),
	status: z.enum(["APPROVED", "REJECTED"]),
	url: z.url(),
});

export async function sendAccessRequestDecidedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, columnName, status, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: accessRequestDecidedTemplate({ columnName, status, url }),
	});
}
