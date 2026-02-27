/**
 * お問い合わせにコメントが追加されたとき、コメント者以外の担当者に送信するメール
 * トリガー: POST /project/:id/inquiries/:id/comments, POST /committee/inquiries/:id/comments
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { inquiryCommentAddedTemplate } from "../templates/inquiryCommentAdded";

const InputSchema = z.object({
	email: z.email(),
	inquiryTitle: z.string().min(1),
	commenterName: z.string().min(1),
	commentBodyPreview: z.string(),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendInquiryCommentAddedEmail(
	input: Input
): Promise<void> {
	const { email, inquiryTitle, commenterName, commentBodyPreview, url } =
		InputSchema.parse(input);

	const template = inquiryCommentAddedTemplate({
		inquiryTitle,
		commenterName,
		commentBodyPreview,
		url,
	});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
