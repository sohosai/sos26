import { sendAccessRequestDecidedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";

/**
 * アクセス申請が承認・却下されたとき、申請者に通知
 */
export async function notifyAccessRequestDecided(input: {
	requesterId: string;
	columnName: string;
	status: "APPROVED" | "REJECTED";
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.requesterId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		await sendAccessRequestDecidedEmail({
			email: user.email,
			columnName: input.columnName,
			status: input.status,
			url: `${env.APP_URL}/committee/mastersheet/`,
		});
	} catch (err) {
		console.error("[Notification] notifyAccessRequestDecided failed", err);
	}
}
