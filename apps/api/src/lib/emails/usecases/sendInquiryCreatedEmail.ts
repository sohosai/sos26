/**
 * お問い合わせが作成されたとき、通知先に送信するメール
 * target="COMMITTEE": 企画がお問い合わせ作成 → INQUIRY_ADMIN 権限保持者へ
 * target="PROJECT": 実委がお問い合わせ作成 → 企画側担当者へ
 */
import { z } from "zod";
import { sendEmail } from "../providers/sendgridClient";
import { inquiryCreatedForCommitteeTemplate } from "../templates/inquiryCreatedForCommittee";
import { inquiryCreatedForProjectTemplate } from "../templates/inquiryCreatedForProject";

const InputSchema = z.object({
	email: z.email(),
	inquiryTitle: z.string().min(1),
	creatorName: z.string().min(1),
	target: z.enum(["COMMITTEE", "PROJECT"]),
	projectName: z.string().optional(),
	url: z.url(),
});

export type Input = z.infer<typeof InputSchema>;

export async function sendInquiryCreatedEmail(input: Input): Promise<void> {
	const { email, inquiryTitle, creatorName, target, projectName, url } =
		InputSchema.parse(input);

	const template =
		target === "COMMITTEE"
			? inquiryCreatedForCommitteeTemplate({
					projectName: projectName ?? "",
					creatorName,
					inquiryTitle,
					url,
				})
			: inquiryCreatedForProjectTemplate({
					creatorName,
					inquiryTitle,
					url,
				});

	await sendEmail({
		to: email,
		subject: template.subject,
		html: template.html,
		text: template.text,
	});
}
