/**
 * フォームの配信承認が申請されたとき、承認者に送信するメール
 * トリガー: POST /committee/forms/:formId/authorizations
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { formAuthorizationRequestedTemplate } from "../templates/formAuthorizationRequested";

const InputSchema = z.object({
	email: z.email(),
	requesterName: z.string().min(1),
	formTitle: z.string().min(1),
	scheduledSendAt: z.string().min(1),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendFormAuthorizationRequestedEmail(
	input: Input
): Promise<void> {
	const { email, requesterName, formTitle, scheduledSendAt, url } =
		InputSchema.parse(input);

	const template = formAuthorizationRequestedTemplate({
		requesterName,
		formTitle,
		scheduledSendAt,
		url,
	});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
