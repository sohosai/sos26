/**
 * 副企画責任者リクエストが承認されたとき、企画責任者に送信するメール
 * トリガー: POST /project/:projectId/sub-owner-request/approve
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { subOwnerRequestApprovedTemplate } from "../templates/subOwnerRequestApproved";

const InputSchema = z.object({
	email: z.email(),
	userName: z.string().min(1),
	projectName: z.string().min(1),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendSubOwnerRequestApprovedEmail(
	input: Input
): Promise<void> {
	const { email, userName, projectName } = InputSchema.parse(input);

	const template = subOwnerRequestApprovedTemplate({
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
