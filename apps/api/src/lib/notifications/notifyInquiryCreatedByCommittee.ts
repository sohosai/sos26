import { sendInquiryCreatedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendInquiryCreatedPush } from "../push";

export async function notifyInquiryCreatedByCommittee(input: {
	inquiryId: string;
	inquiryTitle: string;
	creatorName: string;
	projectAssigneeUserIds: string[];
}): Promise<void> {
	try {
		const users = await prisma.user.findMany({
			where: {
				id: { in: input.projectAssigneeUserIds },
				deletedAt: null,
			},
			select: { email: true, id: true },
		});

		const url = `${env.APP_URL}/project/support/${input.inquiryId}`;

		await Promise.all(
			users.map(user =>
				sendInquiryCreatedEmail({
					email: user.email,
					inquiryTitle: input.inquiryTitle,
					creatorName: input.creatorName,
					target: "PROJECT",
					url,
				})
			)
		);
		await sendInquiryCreatedPush({
			userIds: users.map(user => user.id),
			inquiryTitle: input.inquiryTitle,
		});
	} catch (err) {
		console.error("[Notification] notifyInquiryCreatedByCommittee failed", err);
	}
}
