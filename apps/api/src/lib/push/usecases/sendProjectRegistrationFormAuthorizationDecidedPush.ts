import { z } from "zod";
import { projectRegistrationFormAuthorizationDecidedTemplate } from "../templates/projectRegistrationFormAuthorizationDecided";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userId: z.string().min(1),
	formTitle: z.string().min(1),
	status: z.enum(["APPROVED", "REJECTED"]),
	url: z.url(),
});

export async function sendProjectRegistrationFormAuthorizationDecidedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userId, formTitle, status, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds: [userId],
		payload: projectRegistrationFormAuthorizationDecidedTemplate({
			formTitle,
			status,
			url,
		}),
	});
}
