import { sendSubOwnerRequestRejectedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendSubOwnerRequestRejectedPush } from "../push";

/**
 * 副責任者リクエストが辞退されたとき、責任者に通知
 */
export async function notifySubOwnerRequestRejected(input: {
	ownerUserId: string;
	rejectedUserName: string;
	projectName: string;
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.ownerUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		const url = `${env.APP_URL}/project/members`;
		await sendSubOwnerRequestRejectedEmail({
			email: user.email,
			userName: input.rejectedUserName,
			projectName: input.projectName,
		});
		await sendSubOwnerRequestRejectedPush({
			userId: input.ownerUserId,
			projectName: input.projectName,
			url,
		});
	} catch (err) {
		console.error("[Notification] notifySubOwnerRequestRejected failed", err);
	}
}
