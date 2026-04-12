import { sendSubOwnerRequestSentEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendSubOwnerRequestSentPush } from "../push";

/**
 * 副企画責任者リクエストが送信されたとき、指名されたユーザーに通知
 */
export async function notifySubOwnerRequestSent(input: {
	targetUserId: string;
	ownerName: string;
	projectName: string;
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.targetUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		const url = `${env.APP_URL}/project/members`;
		await sendSubOwnerRequestSentEmail({
			email: user.email,
			ownerName: input.ownerName,
			projectName: input.projectName,
			url,
		});
		await sendSubOwnerRequestSentPush({
			userId: input.targetUserId,
			projectName: input.projectName,
			url,
		});
	} catch (err) {
		console.error("[Notification] notifySubOwnerRequestSent failed", err);
	}
}
