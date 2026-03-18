import { sendFormDeliveredEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendFormDeliveredPush } from "../push";

export async function notifyFormDelivered(input: {
	formTitle: string;
	projectIds: string[];
}): Promise<boolean> {
	try {
		// 対象企画のメンバー全員のメールを取得
		const projects = await prisma.project.findMany({
			where: { id: { in: input.projectIds }, deletedAt: null },
			select: {
				ownerId: true,
				subOwnerId: true,
				projectMembers: {
					where: { deletedAt: null },
					select: { userId: true },
				},
			},
		});

		const userIds = new Set<string>();
		for (const project of projects) {
			userIds.add(project.ownerId);
			if (project.subOwnerId) {
				userIds.add(project.subOwnerId);
			}
			for (const member of project.projectMembers) {
				userIds.add(member.userId);
			}
		}

		if (userIds.size === 0) {
			return true;
		}

		const users = await prisma.user.findMany({
			where: { id: { in: [...userIds] }, deletedAt: null },
			select: { email: true },
		});

		const url = `${env.APP_URL}/project/forms/`;

		await Promise.all(
			users.map(user =>
				sendFormDeliveredEmail({
					email: user.email,
					formTitle: input.formTitle,
					url,
				})
			)
		);
		await sendFormDeliveredPush({
			userIds: [...userIds],
			formTitle: input.formTitle,
			url,
		});

		return true;
	} catch (err) {
		console.error("[Notification] notifyFormDelivered failed", err);
		return false;
	}
}
