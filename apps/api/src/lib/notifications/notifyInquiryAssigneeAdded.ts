import { sendInquiryAssigneeAddedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendInquiryAssigneeAddedPush } from "../push";

export async function notifyInquiryAssigneeAdded(input: {
	addedUserId: string;
	inquiryId: string;
	inquiryTitle: string;
	side: "PROJECT" | "COMMITTEE";
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.addedUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		const url =
			input.side === "COMMITTEE"
				? `${env.APP_URL}/committee/support/${input.inquiryId}`
				: `${env.APP_URL}/project/support/${input.inquiryId}`;

		await sendInquiryAssigneeAddedEmail({
			email: user.email,
			inquiryTitle: input.inquiryTitle,
			url,
		});
		await sendInquiryAssigneeAddedPush({
			userId: input.addedUserId,
			inquiryTitle: input.inquiryTitle,
		});
	} catch (err) {
		console.error("[Notification] notifyInquiryAssigneeAdded failed", err);
	}
}
