import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { alreadyRegisteredTemplate } from "../templates/alreadyRegistered";

const InputSchema = z.object({
	email: z.email(),
	loginUrl: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendAlreadyRegisteredEmail(input: Input): Promise<void> {
	const { email, loginUrl } = InputSchema.parse(input);

	const template = alreadyRegisteredTemplate({ loginUrl });

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
