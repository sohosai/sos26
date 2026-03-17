import { sendNoticeAuthorizationRequestedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendNoticeAuthorizationRequestedPush } from "../push";

export async function notifyNoticeAuthorizationRequested(input: {
	approverUserId: string;
	requesterName: string;
	noticeId: string;
	noticeTitle: string;
	deliveredAt: Date;
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.approverUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		await sendNoticeAuthorizationRequestedEmail({
			email: user.email,
			requesterName: input.requesterName,
			noticeTitle: input.noticeTitle,
			deliveredAt: input.deliveredAt.toLocaleString("ja-JP", {
				timeZone: "Asia/Tokyo",
			}),
			url: `${env.APP_URL}/committee/notice/${input.noticeId}/`,
		});
		await sendNoticeAuthorizationRequestedPush({
			userId: input.approverUserId,
			noticeTitle: input.noticeTitle,
			url: `${env.APP_URL}/committee/notice/${input.noticeId}/`,
		});
	} catch (err) {
		console.error(
			"[Notification] notifyNoticeAuthorizationRequested failed",
			err
		);
	}
}
