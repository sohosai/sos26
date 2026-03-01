import { sendFormAuthorizationDecidedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";

export async function notifyFormAuthorizationDecided(input: {
	requestedByUserId: string;
	formId: string;
	formTitle: string;
	status: "APPROVED" | "REJECTED";
	scheduledSendAt: Date;
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.requestedByUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		await sendFormAuthorizationDecidedEmail({
			email: user.email,
			formTitle: input.formTitle,
			status: input.status,
			scheduledSendAt: input.scheduledSendAt.toLocaleString("ja-JP", {
				timeZone: "Asia/Tokyo",
			}),
			url: `${env.APP_URL}/committee/forms/${input.formId}/`,
		});
	} catch (err) {
		console.error("[Notification] notifyFormAuthorizationDecided failed", err);
	}
}
