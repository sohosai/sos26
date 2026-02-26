import { sendNoticeDeliveredEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";

export async function notifyNoticeDelivered(input: {
	noticeTitle: string;
	noticeBodyPreview: string;
	projectIds: string[];
}): Promise<void> {
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

		const users = await prisma.user.findMany({
			where: { id: { in: [...userIds] }, deletedAt: null },
			select: { email: true },
		});

		const url = `${env.APP_URL}/project/notice/`;

		await Promise.all(
			users.map(user =>
				sendNoticeDeliveredEmail({
					email: user.email,
					noticeTitle: input.noticeTitle,
					noticeBodyPreview: input.noticeBodyPreview,
					url,
				})
			)
		);
	} catch (err) {
		console.error("[Notification] notifyNoticeDelivered failed", err);
	}
}
