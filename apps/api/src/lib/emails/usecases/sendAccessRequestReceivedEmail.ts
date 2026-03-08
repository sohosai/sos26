/**
 * カラムへのアクセス申請が届いたとき、カラム管理者に送信するメール
 * トリガー: POST /committee/mastersheet/columns/:columnId/access-request
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { accessRequestReceivedTemplate } from "../templates/accessRequestReceived";

const InputSchema = z.object({
	email: z.email(),
	requesterName: z.string().min(1),
	columnName: z.string().min(1),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendAccessRequestReceivedEmail(
	input: Input
): Promise<void> {
	const { email, requesterName, columnName, url } = InputSchema.parse(input);

	const template = accessRequestReceivedTemplate({
		requesterName,
		columnName,
		url,
	});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
