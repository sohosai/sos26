import { sendSubOwnerRequestApprovedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendSubOwnerRequestApprovedPush } from "../push";

/**
 * 副企画責任者リクエストが承認されたとき、企画責任者に通知
 */
export async function notifySubOwnerRequestApproved(input: {
	ownerUserId: string;
	approvedUserName: string;
	projectName: string;
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.ownerUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		const url = `${env.APP_URL}/project/members`;
		await sendSubOwnerRequestApprovedEmail({
			email: user.email,
			userName: input.approvedUserName,
			projectName: input.projectName,
		});
		await sendSubOwnerRequestApprovedPush({
			userId: input.ownerUserId,
			projectName: input.projectName,
			url,
		});
	} catch (err) {
		console.error("[Notification] notifySubOwnerRequestApproved failed", err);
	}
}
