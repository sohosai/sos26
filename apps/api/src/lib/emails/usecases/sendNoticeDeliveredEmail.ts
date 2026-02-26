/**
 * お知らせが配信されたとき、対象企画メンバーに送信するメール
 * トリガー: Cron（deliveredAt 到達時）
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { noticeDeliveredTemplate } from "../templates/noticeDelivered";

const InputSchema = z.object({
	email: z.email(),
	noticeTitle: z.string().min(1),
	noticeBodyPreview: z.string(),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendNoticeDeliveredEmail(input: Input): Promise<void> {
	const { email, noticeTitle, noticeBodyPreview, url } =
		InputSchema.parse(input);

	const template = noticeDeliveredTemplate({
		noticeTitle,
		noticeBodyPreview,
		url,
	});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
