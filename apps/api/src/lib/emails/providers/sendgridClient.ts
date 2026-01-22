import sgMail from "@sendgrid/mail";
import { z } from "zod";
import { env } from "../../env";

sgMail.setApiKey(env.SENDGRID_API_KEY);

const SendEmailInputSchema = z.object({
	to: z.email(),
	subject: z.string().min(1, "subject is required"),
	html: z.string().min(1, "html is required"),
	text: z.string().optional(),
});

export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

export class EmailSendError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown
	) {
		super(message);
		this.name = "EmailSendError";
	}
}

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
		throw new EmailSendError("Failed to send email", err);
	}
}
