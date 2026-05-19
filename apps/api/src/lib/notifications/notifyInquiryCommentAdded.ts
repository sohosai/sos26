import { sendInquiryCommentAddedEmail } from "../emails";
import { env } from "../env";
import { prisma } from "../prisma";
import { sendInquiryCommentAddedPush } from "../push";

export async function notifyInquiryCommentAdded(input: {
	inquiryId: string;
	projectId: string;
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

		// 企画側リンクには projectId を付与して、複数企画所属時に正しい企画へ自動切替する
		const projectUrl = `${env.APP_URL}/project/support/${input.inquiryId}?projectId=${input.projectId}`;
		const committeeUrl = `${env.APP_URL}/committee/support/${input.inquiryId}`;

		await Promise.all(
			assignees.map(assignee => {
				const url = assignee.side === "COMMITTEE" ? committeeUrl : projectUrl;

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
				url: committeeUrl,
			}),
			sendInquiryCommentAddedPush({
				userIds: projectUserIds,
				inquiryTitle: input.inquiryTitle,
				url: projectUrl,
			}),
		]);
	} catch (err) {
		console.error("[Notification] notifyInquiryCommentAdded failed", err);
	}
}
