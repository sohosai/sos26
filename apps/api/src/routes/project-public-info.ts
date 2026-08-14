import { updateProjectPublicInfoEndpoint } from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

export const projectPublicInfoRoute = new Hono<AuthEnv>();

const DEFAULT_MAP_APP_SETTING = {
	isDescriptionEditable: true,
	isIconEditable: true,
	isMapImagesEditable: true,
	isOpenStatusEditable: false,
	isStockStatusEditable: false,
};

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
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy code
	async c => {
		const project = c.get("project");
		const role = c.get("projectRole");
		if (role !== "OWNER" && role !== "SUB_OWNER") {
			throw Errors.forbidden(
				"企画情報を編集できるのは企画責任者および副企画責任者のみです"
			);
		}

		const body = await c.req.json().catch(() => ({}));
		const data = updateProjectPublicInfoEndpoint.request.parse(body);
		// 空文字は「アイコン削除」を意味するため、DB上はnullとして扱う（FK制約違反を防ぐ）
		const iconFileId = data.iconFileId === "" ? null : data.iconFileId;

		const setting =
			(await prisma.mapAppSetting.findUnique({
				where: { id: "GLOBAL" },
			})) ?? DEFAULT_MAP_APP_SETTING;

		if (!setting.isDescriptionEditable && data.description !== undefined) {
			throw Errors.invalidRequest("紹介文は現在編集できません");
		}
		if (!setting.isIconEditable && data.iconFileId !== undefined) {
			throw Errors.invalidRequest("アイコンは現在編集できません");
		}
		if (!setting.isMapImagesEditable && data.mapImageFileIds !== undefined) {
			throw Errors.invalidRequest("掲載画像は現在編集できません");
		}
		if (project.type !== "STAGE") {
			if (!setting.isOpenStatusEditable && data.openStatus !== undefined) {
				throw Errors.invalidRequest("状態（開店・閉店）は現在編集できません");
			}
			if (!setting.isStockStatusEditable && data.stockStatus !== undefined) {
				throw Errors.invalidRequest("状態（在庫有無）は現在編集できません");
			}
		}

		const mapImageFileIds = data.mapImageFileIds;
		if (
			mapImageFileIds &&
			new Set(mapImageFileIds).size !== mapImageFileIds.length
		) {
			throw Errors.invalidRequest("同じ画像を複数登録することはできません");
		}

		const isStage = project.type === "STAGE";
		const openStatus = isStage ? "NOT_APPLICABLE" : data.openStatus;
		const stockStatus = isStage ? "NOT_APPLICABLE" : data.stockStatus;

		// 掲載画像は「全削除 → 並び順どおりに再作成」で置き換えるため、
		// sortOrder のユニーク制約に引っかからないよう順序を保証する
		const updated = await prisma.$transaction(async tx => {
			const info = await tx.projectPublicInfo.upsert({
				where: { projectId: project.id },
				update: {
					description: data.description,
					iconFileId,
					openStatus,
					stockStatus,
				},
				create: {
					projectId: project.id,
					description: data.description ?? null,
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
