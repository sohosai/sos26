import { prisma } from "../prisma";

/**
 * 指定した fileId のうち、他の機能からまだ参照されているものの ID を返す。
 *
 * ファイルは機能をまたいで同じ id を指定できてしまう
 * （例: 他人のアバターの fileId を企画の公開アイコンに指定できてしまう）ため、
 * 「呼び出し元のテーブルから参照が外れた」というだけでは、そのファイルを
 * 削除してよい根拠にならない。他機能がまだ使っているファイルを誤って
 * ソフトデリートしないよう、既知の参照先をすべて確認したうえで判定する。
 *
 * 新しく File を参照するテーブル・カラムを追加したら、ここにも追加すること。
 */
export async function findReferencedFileIds(
	fileIds: string[]
): Promise<Set<string>> {
	if (fileIds.length === 0) return new Set();

	const byFileId = { fileId: { in: fileIds } } as const;

	const [
		avatars,
		noticeAttachments,
		inquiryAttachments,
		formAttachments,
		formAnswerFiles,
		formItemEditHistoryFiles,
		projectRegistrationFormItemEditHistoryFiles,
		projectRegistrationFormAnswerFiles,
		projectPublicInfoIcons,
		projectPublicMapImages,
	] = await Promise.all([
		// avatarFileId は File との Prisma リレーションを持たない素の外部キーのため、
		// File 側の back-relation からは見えない。個別に確認する必要がある
		prisma.user.findMany({
			where: { avatarFileId: { in: fileIds } },
			select: { avatarFileId: true },
		}),
		prisma.noticeAttachment.findMany({
			where: { ...byFileId, deletedAt: null },
			select: { fileId: true },
		}),
		prisma.inquiryAttachment.findMany({
			where: { ...byFileId, deletedAt: null },
			select: { fileId: true },
		}),
		prisma.formAttachment.findMany({
			where: { ...byFileId, deletedAt: null },
			select: { fileId: true },
		}),
		prisma.formAnswerFile.findMany({
			where: byFileId,
			select: { fileId: true },
		}),
		prisma.formItemEditHistoryFile.findMany({
			where: byFileId,
			select: { fileId: true },
		}),
		prisma.projectRegistrationFormItemEditHistoryFile.findMany({
			where: byFileId,
			select: { fileId: true },
		}),
		prisma.projectRegistrationFormAnswerFile.findMany({
			where: byFileId,
			select: { fileId: true },
		}),
		prisma.projectPublicInfo.findMany({
			where: { iconFileId: { in: fileIds } },
			select: { iconFileId: true },
		}),
		prisma.projectPublicMapImage.findMany({
			where: byFileId,
			select: { fileId: true },
		}),
	]);

	const referenced = new Set<string>();
	for (const { avatarFileId } of avatars) {
		if (avatarFileId) referenced.add(avatarFileId);
	}
	for (const { iconFileId } of projectPublicInfoIcons) {
		if (iconFileId) referenced.add(iconFileId);
	}
	for (const rows of [
		noticeAttachments,
		inquiryAttachments,
		formAttachments,
		formAnswerFiles,
		formItemEditHistoryFiles,
		projectRegistrationFormItemEditHistoryFiles,
		projectRegistrationFormAnswerFiles,
		projectPublicMapImages,
	]) {
		for (const { fileId } of rows) referenced.add(fileId);
	}

	return referenced;
}
