/**
 * 副責任者リクエストが送信されたとき、指名されたユーザーに送信するメール
 * トリガー: POST /project/:projectId/members/:userId/assign
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { subOwnerRequestSentTemplate } from "../templates/subOwnerRequestSent";

const InputSchema = z.object({
	email: z.email(),
	ownerName: z.string().min(1),
	projectName: z.string().min(1),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendSubOwnerRequestSentEmail(
	input: Input
): Promise<void> {
	const { email, ownerName, projectName, url } = InputSchema.parse(input);

	const template = subOwnerRequestSentTemplate({
		ownerName,
		projectName,
		url,
	});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
