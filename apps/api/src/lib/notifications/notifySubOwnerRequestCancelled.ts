import { sendSubOwnerRequestCancelledEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendSubOwnerRequestCancelledPush } from "../push";

/**
 * 副企画責任者リクエストが取り消されたとき、指名されていたユーザーに通知
 */
export async function notifySubOwnerRequestCancelled(input: {
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
		await sendSubOwnerRequestCancelledEmail({
			email: user.email,
			ownerName: input.ownerName,
			projectName: input.projectName,
		});
		await sendSubOwnerRequestCancelledPush({
			userId: input.targetUserId,
			projectName: input.projectName,
			url,
		});
	} catch (err) {
		console.error("[Notification] notifySubOwnerRequestCancelled failed", err);
	}
}
