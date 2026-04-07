/**
 * 副企画責任者リクエストが辞退されたとき、企画責任者に送信するメール
 * トリガー: POST /project/:projectId/sub-owner-request/reject
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { subOwnerRequestRejectedTemplate } from "../templates/subOwnerRequestRejected";

const InputSchema = z.object({
	email: z.email(),
	userName: z.string().min(1),
	projectName: z.string().min(1),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendSubOwnerRequestRejectedEmail(
	input: Input
): Promise<void> {
	const { email, userName, projectName } = InputSchema.parse(input);

	const template = subOwnerRequestRejectedTemplate({
		userName,
		projectName,
	});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
