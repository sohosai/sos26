import { sendFormDeliveredEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendFormDeliveredPush } from "../push";

export async function notifyFormDelivered(input: {
	formTitle: string;
	projectIds: string[];
}): Promise<boolean> {
	try {
		// 対象企画ごとにメンバーを取得し、企画ごとに通知を送る
		// 複数企画に同じユーザーが所属する場合は複数通知が届く（各企画ごとに対応が必要なため）
		const projects = await prisma.project.findMany({
			where: { id: { in: input.projectIds }, deletedAt: null },
			select: {
				id: true,
				ownerId: true,
				subOwnerId: true,
				projectMembers: {
					where: { deletedAt: null },
					select: { userId: true },
				},
			},
		});

		await Promise.all(
			projects.map(async project => {
				const userIds = new Set<string>();
				userIds.add(project.ownerId);
				if (project.subOwnerId) {
					userIds.add(project.subOwnerId);
				}
				for (const member of project.projectMembers) {
					userIds.add(member.userId);
				}

				if (userIds.size === 0) return;

				const users = await prisma.user.findMany({
					where: { id: { in: [...userIds] }, deletedAt: null },
					select: { email: true },
				});

				const url = `${env.APP_URL}/project/forms/?projectId=${project.id}`;

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
			})
		);

		return true;
	} catch (err) {
		console.error("[Notification] notifyFormDelivered failed", err);
		return false;
	}
}
