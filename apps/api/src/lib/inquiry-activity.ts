import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type SenderRole = "PROJECT" | "COMMITTEE";
type CommentTime = { createdAt: Date; sentAt: Date | null };

export type LatestComments = {
	/** 送信者ロールごとの最新コメント */
	byRole: Partial<Record<SenderRole, CommentTime>>;
	/** 最新コメントの送信者ロール */
	latestSenderRole: SenderRole | null;
};

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

/** a が b より新しいか。並び順は sentAt の降順（NULL は後ろ）、次に createdAt の降順 */
function isNewerComment(a: CommentTime, b: CommentTime) {
	if (a.sentAt && b.sentAt && a.sentAt.getTime() !== b.sentAt.getTime()) {
		return a.sentAt.getTime() > b.sentAt.getTime();
	}
	if (!a.sentAt !== !b.sentAt) return a.sentAt !== null;
	return a.createdAt.getTime() > b.createdAt.getTime();
}

/**
 * 問い合わせごとに、送信者ロール別の最新の送信済みコメントを返す。
 * 全コメントを取ってから最新を選ぶと、行数がコメント数に比例して増えるため DISTINCT ON で絞る。
 */
export async function findLatestComments(
	inquiryIds: string[]
): Promise<Map<string, LatestComments>> {
	const result = new Map<string, LatestComments>();
	if (inquiryIds.length === 0) return result;

	const rows = await prisma.$queryRaw<
		(CommentTime & { inquiryId: string; senderRole: SenderRole })[]
	>(Prisma.sql`
		SELECT DISTINCT ON ("inquiryId", "senderRole")
			"inquiryId", "senderRole", "sentAt", "createdAt"
		FROM "InquiryComment"
		WHERE "inquiryId" = ANY(${inquiryIds})
			AND "deletedAt" IS NULL
			AND "isDraft" = false
		ORDER BY "inquiryId", "senderRole", "sentAt" DESC NULLS LAST, "createdAt" DESC
	`);

	for (const { inquiryId, senderRole, sentAt, createdAt } of rows) {
		const entry = result.get(inquiryId) ?? {
			byRole: {},
			latestSenderRole: null,
		};
		const comment = { sentAt, createdAt };
		entry.byRole[senderRole] = comment;
		const latest = entry.latestSenderRole
			? entry.byRole[entry.latestSenderRole]
			: undefined;
		if (!latest || isNewerComment(comment, latest)) {
			entry.latestSenderRole = senderRole;
		}
		result.set(inquiryId, entry);
	}
	return result;
}

/** 問い合わせごとに、ユーザーがコメントを最後に読んだ時刻を返す */
export async function findLastReadAts(
	inquiryIds: string[],
	userId: string
): Promise<Map<string, Date>> {
	if (inquiryIds.length === 0) return new Map();
	const statuses = await prisma.inquiryCommentReadStatus.findMany({
		where: { inquiryId: { in: inquiryIds }, userId },
		select: { inquiryId: true, lastReadAt: true },
	});
	return new Map(statuses.map(s => [s.inquiryId, s.lastReadAt]));
}
