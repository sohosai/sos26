import { z } from "zod";
import { projectRegistrationFormAuthorizationRequestedTemplate } from "../templates/projectRegistrationFormAuthorizationRequested";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	formTitle: z.string().min(1),
	url: z.url(),
});

export async function sendProjectRegistrationFormAuthorizationRequestedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, formTitle, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: projectRegistrationFormAuthorizationRequestedTemplate({
			formTitle,
			url,
		}),
	});
}
