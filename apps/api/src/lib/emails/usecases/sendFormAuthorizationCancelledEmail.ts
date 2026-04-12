/**
 * 申請の承認が取り消されたとき、申請者に送信するメール
 * トリガー: PATCH /committee/forms/:formId/authorizations/:authorizationId (APPROVED → REJECTED)
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { formAuthorizationCancelledTemplate } from "../templates/formAuthorizationCancelled";

const InputSchema = z.object({
	email: z.email(),
	formTitle: z.string().min(1),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendFormAuthorizationCancelledEmail(
	input: Input
): Promise<void> {
	const { email, formTitle, url } = InputSchema.parse(input);

	const template = formAuthorizationCancelledTemplate({ formTitle, url });

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
