/**
 * 配信承認が承認または却下されたとき、申請者に送信するメール
 * トリガー: PATCH /committee/notices/:id/authorizations/:id
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { noticeAuthorizationApprovedTemplate } from "../templates/noticeAuthorizationApproved";
import { noticeAuthorizationRejectedTemplate } from "../templates/noticeAuthorizationRejected";

const InputSchema = z.object({
	email: z.email(),
	noticeTitle: z.string().min(1),
	status: z.enum(["APPROVED", "REJECTED"]),
	deliveredAt: z.string().min(1).optional(),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendNoticeAuthorizationDecidedEmail(
	input: Input
): Promise<void> {
	const { email, noticeTitle, status, deliveredAt, url } =
		InputSchema.parse(input);

	const template =
		status === "APPROVED"
			? noticeAuthorizationApprovedTemplate({
					noticeTitle,
					deliveredAt: deliveredAt ?? "",
					url,
				})
			: noticeAuthorizationRejectedTemplate({ noticeTitle, url });

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
