import { prisma } from "../../prisma";
import { registerFileAccessChecker } from "../access";

/**
 * お知らせ添付ファイル用のアクセスチェッカー
 *
 * fileId で NoticeAttachment を検索し、以下の条件でアクセスを許可:
 * 1. ユーザーがお知らせの owner または共同編集者
 * 2. ユーザーが配信先企画のメンバー（承認済み & 配信日時到来）
 */
registerFileAccessChecker(async (fileId, user) => {
	// このファイルがお知らせに添付されているか検索
	const attachment = await prisma.noticeAttachment.findFirst({
		where: { fileId, deletedAt: null },
		include: {
			notice: {
				include: {
					collaborators: { where: { deletedAt: null } },
					authorizations: {
						where: {
							status: "APPROVED",
							deliveredAt: { lte: new Date() },
						},
						include: {
							deliveries: true,
						},
					},
				},
			},
		},
	});

	if (!attachment) {
		return false; // このチェッカーでは判定不能
	}

	const notice = attachment.notice;

	// owner チェック
	if (notice.ownerId === user.id) {
		return true;
	}

	// 共同編集者チェック
	if (notice.collaborators.some(col => col.userId === user.id)) {
		return true;
	}

	// 配信先企画のメンバーチェック
	const deliveredProjectIds = notice.authorizations.flatMap(auth =>
		auth.deliveries.map(d => d.projectId)
	);

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
