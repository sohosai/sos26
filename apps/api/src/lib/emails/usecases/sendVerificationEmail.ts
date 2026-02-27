/**
 * アカウント登録時、メールアドレス確認用のリンクを送信するメール
 * トリガー: POST /auth/register
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { verificationTemplate } from "../templates/verification";

const InputSchema = z.object({
	email: z.email(),
	verifyUrl: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendVerificationEmail(input: Input): Promise<void> {
	const { email, verifyUrl } = InputSchema.parse(input);

	const template = verificationTemplate({
		verifyUrl,
	});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
