import { sendFormAuthorizationCancelledEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendFormAuthorizationCancelledPush } from "../push";

export async function notifyFormAuthorizationCancelled(input: {
	requestedByUserId: string;
	formId: string;
	formTitle: string;
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.requestedByUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		await sendFormAuthorizationCancelledEmail({
			email: user.email,
			formTitle: input.formTitle,
			url: `${env.APP_URL}/committee/forms/${input.formId}/`,
		});
		await sendFormAuthorizationCancelledPush({
			userId: input.requestedByUserId,
			formTitle: input.formTitle,
			url: `${env.APP_URL}/committee/forms/${input.formId}/`,
		});
	} catch (err) {
		console.error(
			"[Notification] notifyFormAuthorizationCancelled failed",
			err
		);
	}
}
