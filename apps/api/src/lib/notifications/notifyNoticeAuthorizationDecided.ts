import { sendNoticeAuthorizationDecidedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";

export async function notifyNoticeAuthorizationDecided(input: {
	requestedByUserId: string;
	noticeId: string;
	noticeTitle: string;
	status: "APPROVED" | "REJECTED";
	deliveredAt: Date;
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.requestedByUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		await sendNoticeAuthorizationDecidedEmail({
			email: user.email,
			noticeTitle: input.noticeTitle,
			status: input.status,
			deliveredAt: input.deliveredAt.toLocaleString("ja-JP", {
				timeZone: "Asia/Tokyo",
			}),
			url: `${env.APP_URL}/committee/notice/${input.noticeId}/`,
		});
	} catch (err) {
		console.error(
			"[Notification] notifyNoticeAuthorizationDecided failed",
			err
		);
	}
}
