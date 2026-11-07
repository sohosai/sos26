export function getCommentSentAt(comment: {
	createdAt: Date;
	sentAt: Date | null;
}) {
	return comment.sentAt ?? comment.createdAt;
}

// 実委が最後にコメントした時刻。実委が作成した問い合わせは作成時刻も含める。
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
