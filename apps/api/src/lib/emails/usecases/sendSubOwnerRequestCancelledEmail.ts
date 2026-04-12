/**
 * 副企画責任者リクエストが企画責任者によって取り消されたとき、指名されていたユーザーに送信するメール
 * トリガー: POST /project/:projectId/sub-owner-request/cancel
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { subOwnerRequestCancelledTemplate } from "../templates/subOwnerRequestCancelled";

const InputSchema = z.object({
	email: z.email(),
	ownerName: z.string().min(1),
	projectName: z.string().min(1),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendSubOwnerRequestCancelledEmail(
	input: Input
): Promise<void> {
	const { email, ownerName, projectName } = InputSchema.parse(input);

	const template = subOwnerRequestCancelledTemplate({
		ownerName,
		projectName,
	});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
