import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";

const InputSchema = z.object({
	email: z.email(),
	loginUrl: z.string().url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendAlreadyRegisteredEmail(input: Input): Promise<void> {
	const { email, loginUrl } = InputSchema.parse(input);

	const subject = "アカウント登録のご案内";
	const html = `
    <p>このメールアドレスは既に登録されています。</p>
    <p><a href="${loginUrl}">こちら</a>からログインしてください。</p>
    <hr />
    <p style="color:#555;font-size:0.95em;">心当たりがない場合は、このメールは破棄してください。</p>
  `;
	const text = `このメールアドレスは既に登録されています。\n${loginUrl} からログインしてください。\n\n心当たりがない場合は、このメールは破棄してください。`;

	await sendEmail({
		to: email,
		subject,
		html,
		text,
	});
}
