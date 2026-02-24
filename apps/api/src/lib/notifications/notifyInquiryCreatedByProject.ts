import { sendInquiryCreatedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";

export async function notifyInquiryCreatedByProject(input: {
	inquiryId: string;
	inquiryTitle: string;
	projectName: string;
	creatorName: string;
}): Promise<void> {
	try {
		// INQUIRY_ADMIN 権限を持つ実委メンバーを取得
		const adminPermissions = await prisma.committeeMemberPermission.findMany({
			where: {
				permission: "INQUIRY_ADMIN",
				committeeMember: { deletedAt: null },
			},
			select: {
				committeeMember: {
					select: {
						user: { select: { email: true } },
					},
				},
			},
		});

		const url = `${env.APP_URL}/committee/support/${input.inquiryId}`;

		await Promise.all(
			adminPermissions.map(perm =>
				sendInquiryCreatedEmail({
					email: perm.committeeMember.user.email,
					inquiryTitle: input.inquiryTitle,
					creatorName: input.creatorName,
					target: "COMMITTEE",
					projectName: input.projectName,
					url,
				})
			)
		);
	} catch (err) {
		console.error("[Notification] notifyInquiryCreatedByProject failed", err);
	}
}
