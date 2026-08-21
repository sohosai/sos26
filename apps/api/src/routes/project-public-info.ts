import type {
	MapAppSetting,
	OpenStatus,
	StockStatus,
	UpdateProjectPublicInfoRequest,
} from "@sos26/shared";
import {
	allowedImageMimeTypes,
	DEFAULT_MAP_APP_SETTING,
	updateProjectPublicInfoEndpoint,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { bumpPublicApiCacheVersion } from "../lib/public-api-cache";
import { findReferencedFileIds } from "../lib/storage/references";
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
 *
 * isPublic を要求しないと、フォーム回答の添付など非公開ファイルのIDを
 * 直接APIで指定でき、無認証の公開APIから壊れ画像として見えてしまう。
 * また softDeleteUnreferencedFiles は公開情報系テーブルの参照しか見ないため、
 * 非公開ファイルを紐づけ→外す操作で他機能が使用中のファイルを誤って
 * ソフトデリートしてしまう経路も塞ぐ必要がある。
 */
async function assertFilesUsable(
	projectId: string,
	fileIds: string[]
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
	if (files.some(f => !memberUserIds.has(f.uploadedById))) {
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
	openStatus: OpenStatus | undefined;
	stockStatus: StockStatus | undefined;
};

/**
 * 公開情報を作成／更新する。
 *
 * 掲載画像は「全削除 → 並び順どおりに再作成」で置き換えるため、
 * sortOrder のユニーク制約に引っかからないよう1トランザクションで順序を保証する。
 * undefined のフィールドは「変更なし」を意味する。
 */
async function savePublicInfo(params: SavePublicInfoParams) {
	const {
		projectId,
		description,
		iconFileId,
		mapImageFileIds,
		openStatus,
		stockStatus,
	} = params;

	return prisma.$transaction(async tx => {
		const info = await tx.projectPublicInfo.upsert({
			where: { projectId },
			update: { description, iconFileId, openStatus, stockStatus },
			create: {
				projectId,
				description: description ?? null,
				iconFileId: iconFileId ?? null,
				openStatus: openStatus ?? "NOT_APPLICABLE",
				stockStatus: stockStatus ?? "NOT_APPLICABLE",
			},
		});

		if (mapImageFileIds) {
			await tx.projectPublicMapImage.deleteMany({
				where: { projectPublicInfoId: info.id },
			});
			await tx.projectPublicMapImage.createMany({
				data: mapImageFileIds.map((fileId, sortOrder) => ({
					projectPublicInfoId: info.id,
					fileId,
					sortOrder,
				})),
			});
		}

		return tx.projectPublicInfo.findUniqueOrThrow({
			where: { id: info.id },
			include: {
				mapImages: { orderBy: { sortOrder: "asc" } },
			},
		});
	});
}

/**
 * 公開情報から外れたファイルをソフトデリートする。
 *
 * 差し替え・削除した画像をそのまま残すと、公開ファイルとして
 * URLを知る者から参照され続け、ストレージにも溜まり続けるため。
 *
 * ファイルIDは他機能（アバター等）から流用されている可能性があるため、
 * この企画の公開情報から外れたというだけでは削除してよい根拠にならない。
 * 削除前に findReferencedFileIds で他機能からの参照有無を必ず確認する。
 */
async function softDeleteUnreferencedFiles(
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
			},
		});

		if (!info) {
			return c.json({ publicInfo: null });
		}

		return c.json({
			publicInfo: {
				description: info.description,
				iconFileId: info.iconFileId,
				mapImageFileIds: info.mapImages.map(img => img.fileId),
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

		const setting = await getMapAppSetting();
		assertFieldsEditable(setting, data, project.type);

		if (
			mapImageFileIds &&
			new Set(mapImageFileIds).size !== mapImageFileIds.length
		) {
			throw Errors.invalidRequest("同じ画像を複数登録することはできません");
		}

		await assertFilesUsable(project.id, [
			...(iconFileId ? [iconFileId] : []),
			...(mapImageFileIds ?? []),
		]);

		const isStage = project.type === "STAGE";

		const before = await prisma.projectPublicInfo.findUnique({
			where: { projectId: project.id },
			select: {
				iconFileId: true,
				mapImages: { select: { fileId: true } },
			},
		});

		const updated = await savePublicInfo({
			projectId: project.id,
			description,
			iconFileId,
			mapImageFileIds,
			openStatus: isStage ? "NOT_APPLICABLE" : data.openStatus,
			stockStatus: isStage ? "NOT_APPLICABLE" : data.stockStatus,
		});

		// 開店・在庫状態を即時にオンラインマップへ反映する
		bumpPublicApiCacheVersion();

		// 参照が外れた画像を回収する（保存が確定してから実行する）
		await softDeleteUnreferencedFiles(
			collectFileIds(before),
			collectFileIds(updated)
		);

		return c.json({
			publicInfo: {
				description: updated.description,
				iconFileId: updated.iconFileId,
				mapImageFileIds: updated.mapImages.map(img => img.fileId),
				openStatus: updated.openStatus,
				stockStatus: updated.stockStatus,
			},
		});
	}
);
