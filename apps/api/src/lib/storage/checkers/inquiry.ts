import type { CommitteeMember } from "@prisma/client";
import { prisma } from "../../prisma";
import { registerFileAccessChecker } from "../access";

/** 閲覧者スコープに一致するかチェック */
async function matchesViewerScope(
	inquiryId: string,
	userId: string,
	committeeMember: CommitteeMember
): Promise<boolean> {
	const viewers = await prisma.inquiryViewer.findMany({
		where: { inquiryId, deletedAt: null },
	});

	for (const viewer of viewers) {
		if (viewer.scope === "ALL") return true;
		if (
			viewer.scope === "BUREAU" &&
			viewer.bureauValue === committeeMember.Bureau
		)
			return true;
		if (viewer.scope === "INDIVIDUAL" && viewer.userId === userId) return true;
	}
	return false;
}

/** 実委人としてのアクセス権限チェック */
async function checkCommitteeAccess(
	inquiryId: string,
	userId: string,
	committeeMember: CommitteeMember
): Promise<boolean> {
	// INQUIRY_ADMIN 権限
	const adminPerm = await prisma.committeeMemberPermission.findFirst({
		where: {
			committeeMemberId: committeeMember.id,
			permission: "INQUIRY_ADMIN",
		},
	});
	if (adminPerm) return true;

	// 実委側担当者
	const committeeAssignee = await prisma.inquiryAssignee.findFirst({
		where: { inquiryId, userId, side: "COMMITTEE", deletedAt: null },
	});
	if (committeeAssignee) return true;

	// 閲覧者スコープ
	return matchesViewerScope(inquiryId, userId, committeeMember);
}

/**
 * お問い合わせ添付ファイル用のアクセスチェッカー
 *
 * fileId で InquiryAttachment を検索し、以下の条件でアクセスを許可:
 * 1. INQUIRY_ADMIN 権限を持つ実委人
 * 2. 実委側担当者
 * 3. 企画側担当者
 * 4. 閲覧者スコープに一致（ALL / BUREAU / INDIVIDUAL）
 */
registerFileAccessChecker(async (fileId, user) => {
	// このファイルがお問い合わせに添付されているか検索
	const attachment = await prisma.inquiryAttachment.findFirst({
		where: { fileId, deletedAt: null },
	});

	if (!attachment) {
		return false; // このチェッカーでは判定不能
	}

	const { inquiryId } = attachment;

	// 実委人チェック
	const committeeMember = await prisma.committeeMember.findFirst({
		where: { userId: user.id, deletedAt: null },
	});

	if (committeeMember) {
		return checkCommitteeAccess(inquiryId, user.id, committeeMember);
	}

	// 企画側担当者
	const projectAssignee = await prisma.inquiryAssignee.findFirst({
		where: { inquiryId, userId: user.id, side: "PROJECT", deletedAt: null },
	});
	return !!projectAssignee;
});
