/**
 * 企画登録フォームの承認申請が承認または却下されたとき、申請者に送信するメール
 * トリガー: PATCH /committee/project-registration-forms/:formId/authorizations/:authorizationId
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { projectRegistrationFormAuthorizationApprovedTemplate } from "../templates/projectRegistrationFormAuthorizationApproved";
import { projectRegistrationFormAuthorizationRejectedTemplate } from "../templates/projectRegistrationFormAuthorizationRejected";

const InputSchema = z.object({
	email: z.email(),
	formTitle: z.string().min(1),
	status: z.enum(["APPROVED", "REJECTED"]),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendProjectRegistrationFormAuthorizationDecidedEmail(
	input: Input
): Promise<void> {
	const { email, formTitle, status, url } = InputSchema.parse(input);

	const template =
		status === "APPROVED"
			? projectRegistrationFormAuthorizationApprovedTemplate({ formTitle, url })
			: projectRegistrationFormAuthorizationRejectedTemplate({
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
