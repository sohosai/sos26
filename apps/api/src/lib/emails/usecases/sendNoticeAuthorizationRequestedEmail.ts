/**
 * 配信承認が申請されたとき、承認者に送信するメール
 * トリガー: POST /committee/notices/:id/authorizations
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { noticeAuthorizationRequestedTemplate } from "../templates/noticeAuthorizationRequested";

const InputSchema = z.object({
	email: z.email(),
	requesterName: z.string().min(1),
	noticeTitle: z.string().min(1),
	deliveredAt: z.string().min(1),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendNoticeAuthorizationRequestedEmail(
	input: Input
): Promise<void> {
	const { email, requesterName, noticeTitle, deliveredAt, url } =
		InputSchema.parse(input);

	const template = noticeAuthorizationRequestedTemplate({
		requesterName,
		noticeTitle,
		deliveredAt,
		url,
	});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
