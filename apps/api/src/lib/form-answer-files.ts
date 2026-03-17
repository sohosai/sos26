import type { Prisma } from "@prisma/client";
import type { FormAnswerFile } from "@sos26/shared";
import type { prisma } from "./prisma";

export const formAnswerFileSelect = {
	id: true,
	fileName: true,
	mimeType: true,
	size: true,
	isPublic: true,
	createdAt: true,
} satisfies Prisma.FileSelect;

export function normalizeFileIds(
	fileIds: string[] | null | undefined
): string[] {
	if (!fileIds) return [];
	return [...new Set(fileIds.filter((fileId): fileId is string => !!fileId))];
}

export function mapAnswerFiles<
	T extends {
		sortOrder: number;
		file: {
			id: string;
			fileName: string;
			mimeType: string;
			size: number;
			isPublic: boolean;
			createdAt: Date;
		};
	},
>(files: T[]): FormAnswerFile[] {
	return files
		.slice()
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map(({ sortOrder, file }) => ({
			id: file.id,
			fileName: file.fileName,
			mimeType: file.mimeType,
			size: file.size,
			isPublic: file.isPublic,
			createdAt: file.createdAt.toISOString(),
			sortOrder,
		}));
}

export async function getConfirmedFileMap(
	db: typeof prisma | Prisma.TransactionClient,
	fileIds: string[]
) {
	const uniqueIds = normalizeFileIds(fileIds);
	if (uniqueIds.length === 0) {
		return new Map<string, FormAnswerFile>();
	}

	const files = await db.file.findMany({
		where: {
			id: { in: uniqueIds },
			status: "CONFIRMED",
			deletedAt: null,
		},
		select: formAnswerFileSelect,
	});

	return new Map(
		files.map(file => [
			file.id,
			{
				id: file.id,
				fileName: file.fileName,
				mimeType: file.mimeType,
				size: file.size,
				isPublic: file.isPublic,
				createdAt: file.createdAt.toISOString(),
				sortOrder: 0,
			},
		])
	);
}

export function mapFileIdsToAnswerFiles(
	fileIds: string[],
	fileMap: Map<string, FormAnswerFile>
): FormAnswerFile[] {
	return normalizeFileIds(fileIds)
		.map((fileId, index) => {
			const file = fileMap.get(fileId);
			if (!file) return null;
			return {
				...file,
				sortOrder: index,
			};
		})
		.filter((file): file is FormAnswerFile => file !== null);
}
