/**
 * フォームの配信承認が承認または却下されたとき、申請者に送信するメール
 * トリガー: PATCH /committee/forms/:formId/authorizations/:authorizationId
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { formAuthorizationApprovedTemplate } from "../templates/formAuthorizationApproved";
import { formAuthorizationRejectedTemplate } from "../templates/formAuthorizationRejected";

const InputSchema = z.object({
	email: z.email(),
	formTitle: z.string().min(1),
	status: z.enum(["APPROVED", "REJECTED"]),
	scheduledSendAt: z.string().min(1).optional(),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendFormAuthorizationDecidedEmail(
	input: Input
): Promise<void> {
	const { email, formTitle, status, scheduledSendAt, url } =
		InputSchema.parse(input);

	const template =
		status === "APPROVED"
			? formAuthorizationApprovedTemplate({
					formTitle,
					scheduledSendAt: scheduledSendAt ?? "",
					url,
				})
			: formAuthorizationRejectedTemplate({ formTitle, url });

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
