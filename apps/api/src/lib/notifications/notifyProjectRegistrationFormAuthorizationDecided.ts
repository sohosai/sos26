import { sendProjectRegistrationFormAuthorizationDecidedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendProjectRegistrationFormAuthorizationDecidedPush } from "../push";

export async function notifyProjectRegistrationFormAuthorizationDecided(input: {
	requestedByUserId: string;
	formId: string;
	formTitle: string;
	status: "APPROVED" | "REJECTED";
}): Promise<void> {
	try {
		const user = await prisma.user.findFirst({
			where: { id: input.requestedByUserId, deletedAt: null },
			select: { email: true },
		});
		if (!user) return;

		const url = `${env.APP_URL}/committee/project-registration-forms/${input.formId}/`;

		await sendProjectRegistrationFormAuthorizationDecidedEmail({
			email: user.email,
			formTitle: input.formTitle,
			status: input.status,
			url,
		});
		await sendProjectRegistrationFormAuthorizationDecidedPush({
			userId: input.requestedByUserId,
			formTitle: input.formTitle,
			status: input.status,
			url,
		});
	} catch (err) {
		console.error(
			"[Notification] notifyProjectRegistrationFormAuthorizationDecided failed",
			err
		);
	}
}
