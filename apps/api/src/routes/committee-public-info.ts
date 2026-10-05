import { Prisma } from "@prisma/client";
import type { CommitteeProjectPublicInfo } from "@sos26/shared";
import {
	correctableProjectPublicInfoFields,
	correctCommitteePublicInfoEndpoint,
	hideCommitteePublicInfoFieldEndpoint,
	projectPublicInfoFieldKeys,
	revertCommitteePublicInfoCorrectionEndpoint,
	unhideCommitteePublicInfoFieldEndpoint,
	updateCommitteePublicInfoMapImageEndpoint,
} from "@sos26/shared";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { requirePermission } from "../lib/committee-permission";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { bumpPublicApiCacheVersion } from "../lib/public-api-cache";
import { requireAuth } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

export const committeePublicInfoRoute = new Hono<AuthEnv>();

const requireMapAppSettingEdit = createMiddleware<AuthEnv>(async (c, next) => {
	await requirePermission(
		prisma,
		c.get("user").id,
		"MAP_APP_SETTING_EDIT",
		"マップアプリ設定変更権限がありません"
	);
	await next();
});

committeePublicInfoRoute.use("*", requireAuth, requireMapAppSettingEdit);

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
			previousValue: m.previousValue as string | string[] | null,
		})),
		hiddenMapImageFileIds: mapImages
			.filter(img => img.isHidden)
			.map(img => img.fileId),
	};
}

async function getProject(
	projectId: string
): Promise<CommitteeProjectPublicInfo> {
	const row = await prisma.project.findFirst({
		where: { id: projectId, deletedAt: null },
		select: committeeProjectPublicInfoSelect,
	});
	if (!row) throw Errors.notFound("企画が見つかりません");
	return toCommitteeProjectPublicInfo(row);
}

/** 非表示・修正の対象となる企画情報のIDを返す（企画情報が未登録なら 404） */
async function getPublicInfoId(projectId: string): Promise<string> {
	const info = await prisma.projectPublicInfo.findFirst({
		where: { projectId, project: { deletedAt: null } },
		select: { id: true },
	});
	if (!info) throw Errors.notFound("企画情報が登録されていません");
	return info.id;
}

committeePublicInfoRoute.put("/:projectId/hidden/:field", async c => {
	const { projectId, field } =
		hideCommitteePublicInfoFieldEndpoint.pathParams.parse(c.req.param());
	const userId = c.get("user").id;
	const projectPublicInfoId = await getPublicInfoId(projectId);

	await prisma.projectPublicInfoModeration.upsert({
		where: {
			projectPublicInfoId_field_kind: {
				projectPublicInfoId,
				field,
				kind: "HIDDEN",
			},
		},
		update: { updatedById: userId },
		create: { projectPublicInfoId, field, kind: "HIDDEN", updatedById: userId },
	});
	bumpPublicApiCacheVersion();

	return c.json({ project: await getProject(projectId) });
});

committeePublicInfoRoute.delete("/:projectId/hidden/:field", async c => {
	const { projectId, field } =
		unhideCommitteePublicInfoFieldEndpoint.pathParams.parse(c.req.param());
	const projectPublicInfoId = await getPublicInfoId(projectId);

	await prisma.projectPublicInfoModeration.deleteMany({
		where: { projectPublicInfoId, field, kind: "HIDDEN" },
	});
	bumpPublicApiCacheVersion();

	return c.json({ project: await getProject(projectId) });
});

committeePublicInfoRoute.patch("/:projectId", async c => {
	const { projectId } = correctCommitteePublicInfoEndpoint.pathParams.parse(
		c.req.param()
	);
	const body = await c.req.json().catch(() => ({}));
	const data = correctCommitteePublicInfoEndpoint.request.parse(body);
	const userId = c.get("user").id;

	// 空文字は「未設定に戻す」を意味するため、DB上はnullとして扱う
	const next = {
		...data,
		description: data.description === "" ? null : data.description,
	};

	await prisma.$transaction(async tx => {
		const before = await tx.projectPublicInfo.findFirst({
			where: { projectId, project: { deletedAt: null } },
			select: {
				id: true,
				description: true,
				websiteUrls: true,
				xIds: true,
				instagramIds: true,
				youtubeIds: true,
			},
		});
		if (!before) throw Errors.notFound("企画情報が登録されていません");

		// 値が変わった項目だけを修正として記録する
		const changedFields = correctableProjectPublicInfoFields.filter(field => {
			const key = projectPublicInfoFieldKeys[field];
			const value = next[key];
			return (
				value !== undefined &&
				JSON.stringify(before[key]) !== JSON.stringify(value)
			);
		});
		if (changedFields.length === 0) return;

		await tx.projectPublicInfo.update({
			where: { id: before.id },
			data: next,
		});
		for (const field of changedFields) {
			await tx.projectPublicInfoModeration.upsert({
				where: {
					projectPublicInfoId_field_kind: {
						projectPublicInfoId: before.id,
						field,
						kind: "CORRECTED",
					},
				},
				// 再修正では修正前の値を変えず、企画の値を残し続ける
				update: { updatedById: userId },
				create: {
					projectPublicInfoId: before.id,
					field,
					kind: "CORRECTED",
					previousValue:
						before[projectPublicInfoFieldKeys[field]] ?? Prisma.JsonNull,
					updatedById: userId,
				},
			});
		}
	});
	bumpPublicApiCacheVersion();

	return c.json({ project: await getProject(projectId) });
});

committeePublicInfoRoute.delete("/:projectId/corrections/:field", async c => {
	const { projectId, field } =
		revertCommitteePublicInfoCorrectionEndpoint.pathParams.parse(c.req.param());
	const projectPublicInfoId = await getPublicInfoId(projectId);

	await prisma.$transaction(async tx => {
		const correction = await tx.projectPublicInfoModeration.findUnique({
			where: {
				projectPublicInfoId_field_kind: {
					projectPublicInfoId,
					field,
					kind: "CORRECTED",
				},
			},
			select: { id: true, previousValue: true },
		});
		if (!correction) throw Errors.notFound("修正の記録がありません");

		await tx.projectPublicInfo.update({
			where: { id: projectPublicInfoId },
			data: {
				[projectPublicInfoFieldKeys[field]]: correction.previousValue,
			},
		});
		await tx.projectPublicInfoModeration.delete({
			where: { id: correction.id },
		});
	});
	bumpPublicApiCacheVersion();

	return c.json({ project: await getProject(projectId) });
});

committeePublicInfoRoute.put("/:projectId/map-images/:fileId", async c => {
	const { projectId, fileId } =
		updateCommitteePublicInfoMapImageEndpoint.pathParams.parse(c.req.param());
	const body = await c.req.json().catch(() => ({}));
	const { isHidden } =
		updateCommitteePublicInfoMapImageEndpoint.request.parse(body);
	const projectPublicInfoId = await getPublicInfoId(projectId);

	const { count } = await prisma.projectPublicMapImage.updateMany({
		where: { projectPublicInfoId, fileId },
		data: { isHidden },
	});
	if (count === 0) throw Errors.notFound("指定された画像が見つかりません");
	bumpPublicApiCacheVersion();

	return c.json({ project: await getProject(projectId) });
});
