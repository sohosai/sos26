import type { Prisma } from "@prisma/client";

export function getCommentSentAt(comment: {
	createdAt: Date;
	sentAt: Date | null;
}) {
	return comment.sentAt ?? comment.createdAt;
}

// 未読判定に必要な項目。comments は実委の最新コメント 1 件だけを取得する。
export function committeeActivitySelect(userId: string) {
	return {
		comments: {
			where: {
				deletedAt: null,
				isDraft: false,
				senderRole: "COMMITTEE",
			},
			select: { createdAt: true, sentAt: true },
			orderBy: [
				{ sentAt: { sort: "desc", nulls: "last" } },
				{ createdAt: "desc" },
			],
			take: 1,
		},
		commentReadStatuses: {
			where: { userId },
			select: { lastReadAt: true },
			take: 1,
		},
	} satisfies Prisma.InquirySelect;
}

// 実委からの最新の返信の時刻を返す。comments には実委の最新コメントだけを渡す。
// 実委が作成した問い合わせは、その作成時刻も比較の対象にする。
export function getLatestCommitteeActivityAt(inquiry: {
	sentAt: Date | null;
	creatorRole: "PROJECT" | "COMMITTEE";
	createdAt: Date;
	comments: Array<{ createdAt: Date; sentAt: Date | null }>;
}) {
	const latestCommitteeComment = inquiry.comments[0] ?? null;
	const latestCommitteeCommentAt = latestCommitteeComment
		? getCommentSentAt(latestCommitteeComment)
		: null;
	const committeeCreatedAt =
		inquiry.creatorRole === "COMMITTEE"
			? (inquiry.sentAt ?? inquiry.createdAt)
			: null;

	if (latestCommitteeCommentAt && committeeCreatedAt) {
		return latestCommitteeCommentAt.getTime() > committeeCreatedAt.getTime()
			? latestCommitteeCommentAt
			: committeeCreatedAt;
	}

	return latestCommitteeCommentAt ?? committeeCreatedAt;
}

export function hasUnreadCommitteeActivity(inquiry: {
	sentAt: Date | null;
	creatorRole: "PROJECT" | "COMMITTEE";
	createdAt: Date;
	comments: Array<{ createdAt: Date; sentAt: Date | null }>;
	commentReadStatuses: Array<{ lastReadAt: Date }>;
}) {
	const latestCommitteeActivityAt = getLatestCommitteeActivityAt(inquiry);
	if (!latestCommitteeActivityAt) return false;

	const lastReadAt = inquiry.commentReadStatuses[0]?.lastReadAt ?? null;
	return (
		!lastReadAt || latestCommitteeActivityAt.getTime() > lastReadAt.getTime()
	);
}
