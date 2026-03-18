/**
 * 申請が配信されたとき、対象企画メンバーに送信するメール
 * トリガー: 内部通知同期エンドポイント（scheduledSendAt 到達後）
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { formDeliveredTemplate } from "../templates/formDelivered";

const InputSchema = z.object({
	email: z.email(),
	formTitle: z.string().min(1),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendFormDeliveredEmail(input: Input): Promise<void> {
	const { email, formTitle, url } = InputSchema.parse(input);

	const template = formDeliveredTemplate({
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
