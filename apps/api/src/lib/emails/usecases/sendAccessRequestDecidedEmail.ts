/**
 * カラムへのアクセス申請が承認または却下されたとき、申請者に送信するメール
 * トリガー: PATCH /committee/mastersheet/access-requests/:requestId
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { accessRequestApprovedTemplate } from "../templates/accessRequestApproved";
import { accessRequestRejectedTemplate } from "../templates/accessRequestRejected";

const InputSchema = z.object({
	email: z.email(),
	columnName: z.string().min(1),
	status: z.enum(["APPROVED", "REJECTED"]),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendAccessRequestDecidedEmail(
	input: Input
): Promise<void> {
	const { email, columnName, status, url } = InputSchema.parse(input);

	const template =
		status === "APPROVED"
			? accessRequestApprovedTemplate({ columnName, url })
			: accessRequestRejectedTemplate({ columnName, url });

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
