import { sendAccessRequestReceivedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";

/**
 * アクセス申請が作成されたとき、カラム管理者（CUSTOM: 作成者 / FORM_ITEM: フォームオーナー）に通知
 */
export async function notifyAccessRequestReceived(input: {
	columnId: string;
	requesterName: string;
}): Promise<void> {
	try {
		const column = await prisma.mastersheetColumn.findUnique({
			where: { id: input.columnId },
			select: {
				name: true,
				type: true,
				createdById: true,
				formItem: {
					select: { form: { select: { ownerId: true } } },
				},
			},
		});
		if (!column) return;

		const recipientUserId =
			column.type === "FORM_ITEM"
				? column.formItem?.form.ownerId
				: column.createdById;
		if (!recipientUserId) return;

		const user = await prisma.user.findFirst({
			where: { id: recipientUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		await sendAccessRequestReceivedEmail({
			email: user.email,
			requesterName: input.requesterName,
			columnName: column.name,
			url: `${env.APP_URL}/committee/mastersheet/`,
		});
	} catch (err) {
		console.error("[Notification] notifyAccessRequestReceived failed", err);
	}
}
