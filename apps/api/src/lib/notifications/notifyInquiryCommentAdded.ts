import { sendInquiryCommentAddedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendInquiryCommentAddedPush } from "../push";

export async function notifyInquiryCommentAdded(input: {
	inquiryId: string;
	inquiryTitle: string;
	commenterUserId: string;
	commenterName: string;
	commentBodyPreview: string;
}): Promise<void> {
	try {
		// コメント者以外の全担当者を取得（side でリンク先を振り分け）
		const assignees = await prisma.inquiryAssignee.findMany({
			where: {
				inquiryId: input.inquiryId,
				userId: { not: input.commenterUserId },
				deletedAt: null,
			},
			select: {
				side: true,
				userId: true,
				user: { select: { email: true } },
			},
		});

		await Promise.all(
			assignees.map(assignee => {
				const url =
					assignee.side === "COMMITTEE"
						? `${env.APP_URL}/committee/support/${input.inquiryId}`
						: `${env.APP_URL}/project/support/${input.inquiryId}`;

				return sendInquiryCommentAddedEmail({
					email: assignee.user.email,
					inquiryTitle: input.inquiryTitle,
					commenterName: input.commenterName,
					commentBodyPreview: input.commentBodyPreview,
					url,
				});
			})
		);

		const committeeUserIds = assignees
			.filter(assignee => assignee.side === "COMMITTEE")
			.map(assignee => assignee.userId);
		const projectUserIds = assignees
			.filter(assignee => assignee.side === "PROJECT")
			.map(assignee => assignee.userId);

		await Promise.all([
			sendInquiryCommentAddedPush({
				userIds: committeeUserIds,
				inquiryTitle: input.inquiryTitle,
				url: `${env.APP_URL}/committee/support/${input.inquiryId}`,
			}),
			sendInquiryCommentAddedPush({
				userIds: projectUserIds,
				inquiryTitle: input.inquiryTitle,
				url: `${env.APP_URL}/project/support/${input.inquiryId}`,
			}),
		]);
	} catch (err) {
		console.error("[Notification] notifyInquiryCommentAdded failed", err);
	}
}
