import { Prisma } from "@prisma/client";
import type { CommitteeProjectPublicInfo } from "@sos26/shared";

export const committeeProjectPublicInfoSelect = {
	id: true,
	number: true,
	name: true,
	organizationName: true,
	publicInfo: {
		select: {
			description: true,
			iconFileId: true,
			websiteUrls: true,
			xIds: true,
			instagramIds: true,
			youtubeIds: true,
			openStatus: true,
			stockStatus: true,
			mapImages: {
				orderBy: { sortOrder: "asc" },
				select: { fileId: true, isHidden: true },
			},
			moderations: {
				orderBy: { createdAt: "asc" },
				select: {
					field: true,
					kind: true,
					previousValue: true,
					updatedAt: true,
					updatedBy: { select: { id: true, name: true } },
				},
			},
		},
	},
} as const satisfies Prisma.ProjectSelect;

/**
 * 修正前の値（JSON 列）を項目の値として読む。
 * 文字列・文字列の配列以外は未入力（null）として扱う。
 */
export function toPreviousValue(
	value: Prisma.JsonValue
): string | string[] | null {
	if (typeof value === "string") return value;
	if (Array.isArray(value) && value.every(v => typeof v === "string")) {
		return value as string[];
	}
	return null;
}

/** アイコン・掲載画像の修正前の値に含まれるファイルIDを取り出す */
export function previousFileIds(value: Prisma.JsonValue): string[] {
	return [toPreviousValue(value) ?? []].flat();
}

/**
 * 企画情報の読み取りから書き込みまでを、同じ企画への他の保存・修正と直列にする。
 * 企画情報がまだ無い企画でも効くよう、行ロックではなく企画IDでロックする。
 * トランザクションの最初に呼ぶ。
 */
export async function lockProjectPublicInfo(
	tx: Prisma.TransactionClient,
	projectId: string
): Promise<void> {
	await tx.$executeRaw(
		Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('project_public_info'), hashtext(${projectId}))`
	);
}

export function toCommitteeProjectPublicInfo({
	publicInfo,
	...project
}: Prisma.ProjectGetPayload<{
	select: typeof committeeProjectPublicInfoSelect;
}>): CommitteeProjectPublicInfo {
	if (!publicInfo) {
		return {
			...project,
			publicInfo: null,
			moderations: [],
			hiddenMapImageFileIds: [],
		};
	}
	const { mapImages, moderations, ...info } = publicInfo;
	return {
		...project,
		publicInfo: {
			...info,
			mapImageFileIds: mapImages.map(img => img.fileId),
		},
		moderations: moderations.map(m => ({
			...m,
			previousValue: toPreviousValue(m.previousValue),
		})),
		hiddenMapImageFileIds: mapImages
			.filter(img => img.isHidden)
			.map(img => img.fileId),
	};
}
