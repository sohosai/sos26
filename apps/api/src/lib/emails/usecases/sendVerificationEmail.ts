import { sendEmail } from "../providers/sendgridClient";
import { verificationTemplate } from "../templates/verification";

type Input = {
	email: string;
	verifyUrl: string;
};

export async function sendVerificationEmail(input: Input): Promise<void> {
	const template = verificationTemplate({
		verifyUrl: input.verifyUrl,
	});

	await sendEmail({
		to: input.email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
