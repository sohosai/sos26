import { sendProjectRegistrationFormAuthorizationRequestedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendProjectRegistrationFormAuthorizationRequestedPush } from "../push";

export async function notifyProjectRegistrationFormAuthorizationRequested(input: {
	approverUserId: string;
	requesterName: string;
	formId: string;
	formTitle: string;
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.approverUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		const url = `${env.APP_URL}/committee/project-registration-forms/${input.formId}/`;

		await sendProjectRegistrationFormAuthorizationRequestedEmail({
			email: user.email,
			requesterName: input.requesterName,
			formTitle: input.formTitle,
			url,
		});
		await sendProjectRegistrationFormAuthorizationRequestedPush({
			userId: input.approverUserId,
			formTitle: input.formTitle,
			url,
		});
	} catch (err) {
		console.error(
			"[Notification] notifyProjectRegistrationFormAuthorizationRequested failed",
			err
		);
	}
}
