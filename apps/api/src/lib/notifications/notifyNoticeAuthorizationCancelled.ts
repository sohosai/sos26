import { sendNoticeAuthorizationCancelledEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendNoticeAuthorizationCancelledPush } from "../push";

export async function notifyNoticeAuthorizationCancelled(input: {
	requestedByUserId: string;
	noticeId: string;
	noticeTitle: string;
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.requestedByUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		await sendNoticeAuthorizationCancelledEmail({
			email: user.email,
			noticeTitle: input.noticeTitle,
			url: `${env.APP_URL}/committee/notice/${input.noticeId}/`,
		});
		await sendNoticeAuthorizationCancelledPush({
			userId: input.requestedByUserId,
			noticeTitle: input.noticeTitle,
			url: `${env.APP_URL}/committee/notice/${input.noticeId}/`,
		});
	} catch (err) {
		console.error(
			"[Notification] notifyNoticeAuthorizationCancelled failed",
			err
		);
	}
}
