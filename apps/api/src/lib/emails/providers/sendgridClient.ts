import sgMail from "@sendgrid/mail";
import { ZodError, z } from "zod";
import { env } from "../../env";
import { Errors } from "../../error";

sgMail.setApiKey(env.SENDGRID_API_KEY);

const SendEmailInputSchema = z.object({
	to: z.email(),
	subject: z.string().min(1, "subject is required"),
	html: z.string().min(1, "html is required"),
	text: z.string().optional(),
});

export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

export async function sendEmail(input: SendEmailInput): Promise<void> {
	try {
		const parsed = SendEmailInputSchema.parse(input);

		await sgMail.send({
			to: parsed.to,
			from: env.EMAIL_FROM,
			subject: parsed.subject,
			html: parsed.html,
			text: parsed.text,
			mailSettings: {
				sandboxMode: {
					enable: env.EMAIL_SANDBOX,
				},
			},
		});
	} catch (err) {
		// 入力値の不正はそのまま ZodError を返す
		if (err instanceof ZodError) {
			throw err;
		}

		// 外部サービスの失敗などは内部エラーとして正規化し、詳細は返さない
		console.error("[Email] Failed to send email via SendGrid", err);
		throw Errors.internal("メール送信に失敗しました");
	}
}
