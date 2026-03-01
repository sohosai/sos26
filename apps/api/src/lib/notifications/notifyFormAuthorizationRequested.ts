import { sendFormAuthorizationRequestedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";

export async function notifyFormAuthorizationRequested(input: {
	approverUserId: string;
	requesterName: string;
	formId: string;
	formTitle: string;
	scheduledSendAt: Date;
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.approverUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		await sendFormAuthorizationRequestedEmail({
			email: user.email,
			requesterName: input.requesterName,
			formTitle: input.formTitle,
			scheduledSendAt: input.scheduledSendAt.toLocaleString("ja-JP", {
				timeZone: "Asia/Tokyo",
			}),
			url: `${env.APP_URL}/committee/forms/${input.formId}/`,
		});
	} catch (err) {
		console.error(
			"[Notification] notifyFormAuthorizationRequested failed",
			err
		);
	}
}
