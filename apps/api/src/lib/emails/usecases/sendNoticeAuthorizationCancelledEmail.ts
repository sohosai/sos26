/**
 * お知らせの承認が取り消されたとき、申請者に送信するメール
 * トリガー: PATCH /committee/notices/:noticeId/authorizations/:authorizationId (APPROVED → REJECTED)
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { noticeAuthorizationCancelledTemplate } from "../templates/noticeAuthorizationCancelled";

const InputSchema = z.object({
	email: z.email(),
	noticeTitle: z.string().min(1),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendNoticeAuthorizationCancelledEmail(
	input: Input
): Promise<void> {
	const { email, noticeTitle, url } = InputSchema.parse(input);

	const template = noticeAuthorizationCancelledTemplate({ noticeTitle, url });

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
