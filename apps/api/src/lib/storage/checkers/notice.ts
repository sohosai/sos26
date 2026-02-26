import { prisma } from "../../prisma";
import { registerFileAccessChecker } from "../access";

/**
 * お知らせ添付ファイル用のアクセスチェッカー
 *
 * fileId で NoticeAttachment を検索し、以下の条件でアクセスを許可:
 * 1. 実委人（committeeMember）なら誰でもアクセス可
 * 2. 配信先企画のメンバー（承認済み & 配信日時到来）
 */
registerFileAccessChecker(async (fileId, user) => {
	// このファイルがお知らせに添付されているか検索
	const attachment = await prisma.noticeAttachment.findFirst({
		where: { fileId, deletedAt: null },
	});

	if (!attachment) {
		return false; // このチェッカーでは判定不能
	}

	// 実委人なら誰でもアクセス可
	const committeeMember = await prisma.committeeMember.findFirst({
		where: { userId: user.id, deletedAt: null },
	});

	if (committeeMember) {
		return true;
	}

	// 配信先企画のメンバーチェック
	const deliveredProjectIds = await prisma.noticeDelivery
		.findMany({
			where: {
				noticeAuthorization: {
					noticeId: attachment.noticeId,
					status: "APPROVED",
					deliveredAt: { lte: new Date() },
				},
			},
			select: { projectId: true },
		})
		.then(rows => rows.map(r => r.projectId));

	if (deliveredProjectIds.length === 0) {
		return false;
	}

	const membership = await prisma.project.findFirst({
		where: {
			id: { in: deliveredProjectIds },
			deletedAt: null,
			OR: [
				{ ownerId: user.id },
				{ subOwnerId: user.id },
				{
					projectMembers: {
						some: { userId: user.id, deletedAt: null },
					},
				},
			],
		},
	});

	return membership !== null;
});
