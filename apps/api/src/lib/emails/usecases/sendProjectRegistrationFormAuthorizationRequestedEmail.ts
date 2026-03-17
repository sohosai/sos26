/**
 * 企画登録フォームの承認が申請されたとき、承認者に送信するメール
 * トリガー: POST /committee/project-registration-forms/:formId/authorizations
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { projectRegistrationFormAuthorizationRequestedTemplate } from "../templates/projectRegistrationFormAuthorizationRequested";

const InputSchema = z.object({
	email: z.email(),
	requesterName: z.string().min(1),
	formTitle: z.string().min(1),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendProjectRegistrationFormAuthorizationRequestedEmail(
	input: Input
): Promise<void> {
	const { email, requesterName, formTitle, url } = InputSchema.parse(input);

	const template = projectRegistrationFormAuthorizationRequestedTemplate({
		requesterName,
		formTitle,
		url,
	});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
