import { z } from "zod";
import { formAuthorizationDecidedTemplate } from "../templates/formAuthorizationDecided";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	formTitle: z.string().min(1),
	status: z.enum(["APPROVED", "REJECTED"]),
	url: z.url(),
});

export async function sendFormAuthorizationDecidedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, formTitle, status, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: formAuthorizationDecidedTemplate({ formTitle, status, url }),
	});
}
