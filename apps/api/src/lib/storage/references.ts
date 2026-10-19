import { prisma } from "../prisma";
import { previousFileIds } from "../project-public-info";
import { deleteResizedImages } from "./image-resize";

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
		correctedFileFields,
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
		// 実委人が修正したアイコン・掲載画像は、元に戻せるよう修正前のファイルIDを JSON で持つ
		prisma.projectPublicInfoModeration.findMany({
			where: {
				kind: "CORRECTED",
				field: { in: ["ICON", "MAP_IMAGES"] },
				OR: fileIds.flatMap(id => [
					{ previousValue: { equals: id } },
					{ previousValue: { array_contains: [id] } },
				]),
			},
			select: { previousValue: true },
		}),
	]);

	const referenced = new Set<string>();
	for (const { avatarFileId } of avatars) {
		if (avatarFileId) referenced.add(avatarFileId);
	}
	for (const { iconFileId } of projectPublicInfoIcons) {
		if (iconFileId) referenced.add(iconFileId);
	}
	const requested = new Set(fileIds);
	for (const id of correctedFileFields.flatMap(m =>
		previousFileIds(m.previousValue)
	)) {
		if (requested.has(id)) referenced.add(id);
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

/**
 * 参照が外れたファイルをソフトデリートする。
 *
 * 差し替え・削除した画像をそのまま残すと、公開ファイルとして
 * URLを知る者から参照され続け、ストレージにも溜まり続けるため。
 *
 * ファイルIDは他機能（アバター等）から流用されている可能性があるため、
 * 呼び出し元から外れたというだけでは削除してよい根拠にならない。
 * 削除前に findReferencedFileIds で他機能からの参照有無を必ず確認する。
 */
export async function softDeleteUnreferencedFiles(
	previousFileIds: string[],
	nextFileIds: string[]
): Promise<void> {
	const nextIds = new Set(nextFileIds);
	const removedIds = [...new Set(previousFileIds)].filter(
		id => !nextIds.has(id)
	);
	if (removedIds.length === 0) return;

	const referenced = await findReferencedFileIds(removedIds);
	const deletableIds = removedIds.filter(id => !referenced.has(id));
	if (deletableIds.length === 0) return;

	await prisma.file.updateMany({
		where: { id: { in: deletableIds }, deletedAt: null },
		data: { deletedAt: new Date() },
	});
	await deleteResizedImages(deletableIds);
}
