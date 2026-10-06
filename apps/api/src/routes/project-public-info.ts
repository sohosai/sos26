import type {
	MapAppSetting,
	OpenStatus,
	ProjectPublicInfoField,
	ProjectSnsLinkKey,
	StockStatus,
	UpdateProjectPublicInfoRequest,
} from "@sos26/shared";
import {
	allowedImageMimeTypes,
	DEFAULT_MAP_APP_SETTING,
	projectPublicInfoFieldKeys,
	projectPublicInfoFieldSchema,
	projectSnsLinkKeys,
	updateProjectPublicInfoEndpoint,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { bumpPublicApiCacheVersion } from "../lib/public-api-cache";
import { softDeleteUnreferencedFiles } from "../lib/storage/references";
import { requireAuth, requireProjectMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

export const projectPublicInfoRoute = new Hono<AuthEnv>();

/** 現在のマップアプリ設定を取得する（レコード未作成なら既定値） */
async function getMapAppSetting(): Promise<MapAppSetting> {
	const setting = await prisma.mapAppSetting.findUnique({
		where: { id: "GLOBAL" },
	});
	return setting ?? DEFAULT_MAP_APP_SETTING;
}

/** 実委人が編集を止めている項目が送られてきていないか検証する */
function assertFieldsEditable(
	setting: MapAppSetting,
	data: UpdateProjectPublicInfoRequest,
	projectType: string
): void {
	if (!setting.isDescriptionEditable && data.description !== undefined) {
		throw Errors.invalidRequest("紹介文は現在編集できません");
	}
	if (!setting.isIconEditable && data.iconFileId !== undefined) {
		throw Errors.invalidRequest("アイコンは現在編集できません");
	}
	if (!setting.isMapImagesEditable && data.mapImageFileIds !== undefined) {
		throw Errors.invalidRequest("掲載画像は現在編集できません");
	}
	if (
		!setting.isSnsLinksEditable &&
		projectSnsLinkKeys.some(key => data[key] !== undefined)
	) {
		throw Errors.invalidRequest("SNSリンクは現在編集できません");
	}
	// ステージ企画は開店・在庫状態を持たないため、設定に関係なく無視する
	if (projectType === "STAGE") return;

	if (!setting.isOpenStatusEditable && data.openStatus !== undefined) {
		throw Errors.invalidRequest("状態（開店・閉店）は現在編集できません");
	}
	if (!setting.isStockStatusEditable && data.stockStatus !== undefined) {
		throw Errors.invalidRequest("状態（在庫有無）は現在編集できません");
	}
}

/**
 * 公開情報に紐づけようとしているファイルが使用可能か検証する。
 *
 * ファイルIDはクライアントから任意の値を送れるため、
 * 「実在する」「アップロード完了済み」「公開ファイル」「画像」
 * 「自企画のメンバーがアップロードした」の5点をサーバー側で必ず確認する。
 * ただし、すでに公開情報に付いているファイル（実委人が修正で設定したもの）は
 * アップロードした人を問わない。
 *
 * isPublic を要求しないと、フォーム回答の添付など非公開ファイルのIDを
 * 直接APIで指定でき、無認証の公開APIから壊れ画像として見えてしまう。
 * また softDeleteUnreferencedFiles は公開情報系テーブルの参照しか見ないため、
 * 非公開ファイルを紐づけ→外す操作で他機能が使用中のファイルを誤って
 * ソフトデリートしてしまう経路も塞ぐ必要がある。
 */
async function assertFilesUsable(
	projectId: string,
	fileIds: string[],
	attachedFileIds: string[]
): Promise<void> {
	if (fileIds.length === 0) return;

	const [files, members] = await Promise.all([
		prisma.file.findMany({
			where: {
				id: { in: fileIds },
				status: "CONFIRMED",
				isPublic: true,
				deletedAt: null,
			},
			select: { id: true, mimeType: true, uploadedById: true },
		}),
		prisma.projectMember.findMany({
			where: { projectId, deletedAt: null },
			select: { userId: true },
		}),
	]);

	if (files.length !== fileIds.length) {
		throw Errors.invalidRequest(
			"指定された画像が見つかりません。アップロードし直してください"
		);
	}

	const imageMimeTypes = new Set<string>(allowedImageMimeTypes);
	if (files.some(f => !imageMimeTypes.has(f.mimeType))) {
		throw Errors.invalidRequest("画像ファイルのみ設定できます");
	}

	const memberUserIds = new Set(members.map(m => m.userId));
	const attached = new Set(attachedFileIds);
	if (
		files.some(f => !attached.has(f.id) && !memberUserIds.has(f.uploadedById))
	) {
		throw Errors.forbidden("他の企画のファイルは設定できません");
	}
}

/** 公開情報が参照しているファイルIDをまとめる */
function collectFileIds(
	info: {
		iconFileId: string | null;
		mapImages: { fileId: string }[];
	} | null
): string[] {
	if (!info) return [];
	return [
		...(info.iconFileId ? [info.iconFileId] : []),
		...info.mapImages.map(img => img.fileId),
	];
}

type SavePublicInfoParams = {
	projectId: string;
	description: string | null | undefined;
	iconFileId: string | null | undefined;
	mapImageFileIds: string[] | undefined;
	snsLinks: Record<ProjectSnsLinkKey, string[] | undefined>;
	openStatus: OpenStatus | undefined;
	stockStatus: StockStatus | undefined;
};

/** 保存で値が変わる項目を返す（undefined は変更なし） */
function findChangedFields(
	before: Record<string, unknown> | null,
	next: Record<string, string | string[] | null | undefined>
): ProjectPublicInfoField[] {
	if (!before) return [];
	return projectPublicInfoFieldSchema.options.filter(field => {
		const key = projectPublicInfoFieldKeys[field];
		const nextValue = next[key];
		if (nextValue === undefined) return false;
		return JSON.stringify(before[key] ?? null) !== JSON.stringify(nextValue);
	});
}

/**
 * 公開情報を作成／更新する。
 *
 * 掲載画像は「全削除 → 並び順どおりに再作成」で置き換えるため、
 * sortOrder のユニーク制約に引っかからないよう1トランザクションで順序を保証する。
 * 実委人による非表示は、保存後も残る画像にファイルIDで引き継ぐ。
 * 実委人が修正した項目を企画が変えた場合は、修正の記録を消す。
 * undefined のフィールドは「変更なし」を意味する。
 */
async function savePublicInfo(params: SavePublicInfoParams) {
	const {
		projectId,
		description,
		iconFileId,
		mapImageFileIds,
		snsLinks,
		openStatus,
		stockStatus,
	} = params;

	return prisma.$transaction(async tx => {
		const beforeRow = await tx.projectPublicInfo.findUnique({
			where: { projectId },
			select: {
				description: true,
				iconFileId: true,
				websiteUrls: true,
				xIds: true,
				instagramIds: true,
				youtubeIds: true,
				mapImages: {
					orderBy: { sortOrder: "asc" },
					select: { fileId: true, isHidden: true },
				},
				moderations: {
					where: { kind: "CORRECTED" },
					select: { field: true, previousValue: true },
				},
			},
		});
		const before = beforeRow && {
			...beforeRow,
			mapImageFileIds: beforeRow.mapImages.map(img => img.fileId),
		};

		const info = await tx.projectPublicInfo.upsert({
			where: { projectId },
			update: { description, iconFileId, ...snsLinks, openStatus, stockStatus },
			create: {
				projectId,
				description: description ?? null,
				iconFileId: iconFileId ?? null,
				websiteUrls: snsLinks.websiteUrls ?? [],
				xIds: snsLinks.xIds ?? [],
				instagramIds: snsLinks.instagramIds ?? [],
				youtubeIds: snsLinks.youtubeIds ?? [],
				openStatus: openStatus ?? "NOT_APPLICABLE",
				stockStatus: stockStatus ?? "NOT_APPLICABLE",
			},
		});

		if (mapImageFileIds) {
			const hiddenFileIds = new Set(
				(before?.mapImages ?? [])
					.filter(img => img.isHidden)
					.map(img => img.fileId)
			);
			await tx.projectPublicMapImage.deleteMany({
				where: { projectPublicInfoId: info.id },
			});
			await tx.projectPublicMapImage.createMany({
				data: mapImageFileIds.map((fileId, sortOrder) => ({
					projectPublicInfoId: info.id,
					fileId,
					sortOrder,
					isHidden: hiddenFileIds.has(fileId),
				})),
			});
		}

		const changedFields = findChangedFields(before, {
			description,
			iconFileId,
			mapImageFileIds,
			...snsLinks,
		});
		// 消す修正の記録が残していた修正前のファイルは、保存後に回収する
		// （ファイルIDを持つのはアイコン・掲載画像の記録だけ）
		const releasedFileIds = (before?.moderations ?? [])
			.filter(
				m =>
					(m.field === "ICON" || m.field === "MAP_IMAGES") &&
					changedFields.includes(m.field)
			)
			.flatMap(m => m.previousValue)
			.filter(id => typeof id === "string");
		if (changedFields.length > 0) {
			await tx.projectPublicInfoModeration.deleteMany({
				where: {
					projectPublicInfoId: info.id,
					kind: "CORRECTED",
					field: { in: changedFields },
				},
			});
		}

		const updated = await tx.projectPublicInfo.findUniqueOrThrow({
			where: { id: info.id },
			include: {
				mapImages: { orderBy: { sortOrder: "asc" } },
			},
		});

		return { before, updated, releasedFileIds };
	});
}

projectPublicInfoRoute.get(
	"/:projectId/public-info",
	requireAuth,
	requireProjectMember,
	async c => {
		const project = c.get("project");

		const info = await prisma.projectPublicInfo.findUnique({
			where: { projectId: project.id },
			include: {
				mapImages: {
					orderBy: { sortOrder: "asc" },
				},
				moderations: { select: { field: true, kind: true } },
			},
		});

		if (!info) {
			return c.json({
				publicInfo: null,
				hiddenFields: [],
				correctedFields: [],
				hiddenMapImageFileIds: [],
			});
		}

		const fieldsOf = (kind: "HIDDEN" | "CORRECTED") =>
			info.moderations.filter(m => m.kind === kind).map(m => m.field);

		return c.json({
			hiddenFields: fieldsOf("HIDDEN"),
			correctedFields: fieldsOf("CORRECTED"),
			hiddenMapImageFileIds: info.mapImages
				.filter(img => img.isHidden)
				.map(img => img.fileId),
			publicInfo: {
				description: info.description,
				iconFileId: info.iconFileId,
				mapImageFileIds: info.mapImages.map(img => img.fileId),
				websiteUrls: info.websiteUrls,
				xIds: info.xIds,
				instagramIds: info.instagramIds,
				youtubeIds: info.youtubeIds,
				openStatus: info.openStatus,
				stockStatus: info.stockStatus,
			},
		});
	}
);

projectPublicInfoRoute.put(
	"/:projectId/public-info",
	requireAuth,
	requireProjectMember,
	async c => {
		const project = c.get("project");
		const role = c.get("projectRole");
		if (role !== "OWNER" && role !== "SUB_OWNER") {
			throw Errors.forbidden(
				"企画情報を編集できるのは企画責任者および副企画責任者のみです"
			);
		}
		if (project.deletionStatus !== null) {
			throw Errors.forbidden("この企画は現在編集できません");
		}

		const body = await c.req.json().catch(() => ({}));
		const data = updateProjectPublicInfoEndpoint.request.parse(body);

		// 空文字は「未設定に戻す」を意味するため、DB上はnullとして扱う
		// （アイコンは FK 制約違反、紹介文は空文字と未設定の混在を防ぐ）
		const iconFileId = data.iconFileId === "" ? null : data.iconFileId;
		const description = data.description === "" ? null : data.description;
		const mapImageFileIds = data.mapImageFileIds;
		const snsLinks = {
			websiteUrls: data.websiteUrls,
			xIds: data.xIds,
			instagramIds: data.instagramIds,
			youtubeIds: data.youtubeIds,
		};

		const setting = await getMapAppSetting();
		assertFieldsEditable(setting, data, project.type);

		if (
			mapImageFileIds &&
			new Set(mapImageFileIds).size !== mapImageFileIds.length
		) {
			throw Errors.invalidRequest("同じ画像を複数登録することはできません");
		}

		const current = await prisma.projectPublicInfo.findUnique({
			where: { projectId: project.id },
			select: { iconFileId: true, mapImages: { select: { fileId: true } } },
		});
		await assertFilesUsable(
			project.id,
			[...(iconFileId ? [iconFileId] : []), ...(mapImageFileIds ?? [])],
			collectFileIds(current)
		);

		const isStage = project.type === "STAGE";

		const { before, updated, releasedFileIds } = await savePublicInfo({
			projectId: project.id,
			description,
			iconFileId,
			mapImageFileIds,
			snsLinks,
			openStatus: isStage ? "NOT_APPLICABLE" : data.openStatus,
			stockStatus: isStage ? "NOT_APPLICABLE" : data.stockStatus,
		});

		// 開店・在庫状態を即時にオンラインマップへ反映する
		bumpPublicApiCacheVersion();

		// 参照が外れた画像を回収する（保存が確定してから実行する）
		await softDeleteUnreferencedFiles(
			[...collectFileIds(before), ...releasedFileIds],
			collectFileIds(updated)
		);

		return c.json({
			publicInfo: {
				description: updated.description,
				iconFileId: updated.iconFileId,
				mapImageFileIds: updated.mapImages.map(img => img.fileId),
				websiteUrls: updated.websiteUrls,
				xIds: updated.xIds,
				instagramIds: updated.instagramIds,
				youtubeIds: updated.youtubeIds,
				openStatus: updated.openStatus,
				stockStatus: updated.stockStatus,
			},
		});
	}
);
