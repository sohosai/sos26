import sgMail from "@sendgrid/mail";
import { env } from "../../env";

sgMail.setApiKey(env.SENDGRID_API_KEY);

export type SendEmailInput = {
	to: string;
	subject: string;
	html: string;
	text?: string;
};

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
		await sgMail.send({
			to: input.to,
			from: env.EMAIL_FROM,
			subject: input.subject,
			html: input.html,
			text: input.text,
			mailSettings: {
				sandboxMode: {
					enable: env.EMAIL_SANDBOX === "true",
				},
			},
		});
	} catch (err) {
		throw new EmailSendError("Failed to send email", err);
	}
}
