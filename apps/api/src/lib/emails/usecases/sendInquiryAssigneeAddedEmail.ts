/**
 * お問い合わせの担当者に追加されたとき、追加された担当者に送信するメール
 * トリガー: POST /committee/inquiries/:id/assignees
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { inquiryAssigneeAddedTemplate } from "../templates/inquiryAssigneeAdded";

const InputSchema = z.object({
	email: z.email(),
	inquiryTitle: z.string().min(1),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendInquiryAssigneeAddedEmail(
	input: Input
): Promise<void> {
	const { email, inquiryTitle, url } = InputSchema.parse(input);

	const template = inquiryAssigneeAddedTemplate({
		inquiryTitle,
		url,
	});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
