import { Prisma } from "@prisma/client";
import type { CommitteeProjectPublicInfo } from "@sos26/shared";
import {
	allowedImageMimeTypes,
	correctCommitteePublicInfoEndpoint,
	hideCommitteePublicInfoFieldEndpoint,
	projectPublicInfoFieldKeys,
	projectPublicInfoFieldSchema,
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
import { softDeleteUnreferencedFiles } from "../lib/storage/references";
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

/**
 * 修正前の値（JSON 列）を項目の値として読む。
 * 文字列・文字列の配列以外は未入力（null）として扱う。
 */
function toPreviousValue(value: Prisma.JsonValue): string | string[] | null {
	if (typeof value === "string") return value;
	if (Array.isArray(value) && value.every(v => typeof v === "string")) {
		return value as string[];
	}
	return null;
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

type PublicInfoValues = {
	description?: string | null;
	iconFileId?: string | null;
	mapImageFileIds?: string[];
	websiteUrls?: string[];
	xIds?: string[];
	instagramIds?: string[];
	youtubeIds?: string[];
};

const beforeSelect = {
	id: true,
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
		where: { kind: "CORRECTED", field: { in: ["ICON", "MAP_IMAGES"] } },
		select: { previousValue: true },
	},
} as const satisfies Prisma.ProjectPublicInfoSelect;

type BeforeRow = Prisma.ProjectPublicInfoGetPayload<{
	select: typeof beforeSelect;
}>;

/** 企画情報が未登録なら id が null の空の値として扱う */
type BeforeInfo = Omit<BeforeRow, "id"> & { id: string | null };

function fileIdsOf(values: {
	iconFileId: string | null;
	mapImageFileIds: string[];
}): string[] {
	return [
		...(values.iconFileId ? [values.iconFileId] : []),
		...values.mapImageFileIds,
	];
}

function valuesOf(row: BeforeInfo) {
	return { ...row, mapImageFileIds: row.mapImages.map(img => img.fileId) };
}

/**
 * 修正で設定するファイルを検証する。
 *
 * 企画側の保存と同じく「実在する」「アップロード完了済み」「公開ファイル」「画像」を確認する。
 * アップロードした人は、操作した実委人本人に限る。ただし、すでにこの企画情報に付いている
 * ファイル（修正前の値として残しているものを含む）は問わない。
 */
async function assertCorrectionFilesUsable(
	userId: string,
	fileIds: string[],
	before: BeforeInfo
): Promise<void> {
	if (fileIds.length === 0) return;

	const files = await prisma.file.findMany({
		where: {
			id: { in: fileIds },
			status: "CONFIRMED",
			isPublic: true,
			deletedAt: null,
		},
		select: { id: true, mimeType: true, uploadedById: true },
	});
	if (files.length !== new Set(fileIds).size) {
		throw Errors.invalidRequest(
			"指定された画像が見つかりません。アップロードし直してください"
		);
	}

	const imageMimeTypes = new Set<string>(allowedImageMimeTypes);
	if (files.some(f => !imageMimeTypes.has(f.mimeType))) {
		throw Errors.invalidRequest("画像ファイルのみ設定できます");
	}

	const attached = new Set([
		...fileIdsOf(valuesOf(before)),
		...before.moderations.flatMap(m => toPreviousValue(m.previousValue) ?? []),
	]);
	if (files.some(f => !attached.has(f.id) && f.uploadedById !== userId)) {
		throw Errors.forbidden("他の人がアップロードしたファイルは設定できません");
	}
}

/** 登録値を書き換える。掲載画像は作り直し、残る画像の非表示は引き継ぐ */
async function writeValues(
	tx: Prisma.TransactionClient,
	before: BeforeRow,
	{ mapImageFileIds, ...columns }: PublicInfoValues
): Promise<void> {
	await tx.projectPublicInfo.update({
		where: { id: before.id },
		data: columns,
	});
	if (mapImageFileIds === undefined) return;

	const hiddenFileIds = new Set(
		before.mapImages.filter(img => img.isHidden).map(img => img.fileId)
	);
	await tx.projectPublicMapImage.deleteMany({
		where: { projectPublicInfoId: before.id },
	});
	await tx.projectPublicMapImage.createMany({
		data: mapImageFileIds.map((fileId, sortOrder) => ({
			projectPublicInfoId: before.id,
			fileId,
			sortOrder,
			isHidden: hiddenFileIds.has(fileId),
		})),
	});
}

/**
 * 修正の対象となる企画情報を返す。企画情報が未登録なら空の値を返す。
 * 企画情報は値を書き込むときに作る。
 */
async function findBeforeOrEmpty(projectId: string): Promise<BeforeInfo> {
	const project = await prisma.project.findFirst({
		where: { id: projectId, deletedAt: null },
		select: { publicInfo: { select: beforeSelect } },
	});
	if (!project) throw Errors.notFound("企画が見つかりません");
	return (
		project.publicInfo ?? {
			id: null,
			description: null,
			iconFileId: null,
			websiteUrls: [],
			xIds: [],
			instagramIds: [],
			youtubeIds: [],
			mapImages: [],
			moderations: [],
		}
	);
}

async function findBefore(projectId: string): Promise<BeforeRow> {
	const before = await prisma.projectPublicInfo.findFirst({
		where: { projectId, project: { deletedAt: null } },
		select: beforeSelect,
	});
	if (!before) throw Errors.notFound("企画情報が登録されていません");
	return before;
}

committeePublicInfoRoute.patch("/:projectId", async c => {
	const { projectId } = correctCommitteePublicInfoEndpoint.pathParams.parse(
		c.req.param()
	);
	const body = await c.req.json().catch(() => ({}));
	const data = correctCommitteePublicInfoEndpoint.request.parse(body);
	const userId = c.get("user").id;

	// 空文字は「未設定に戻す」を意味するため、DB上はnullとして扱う
	const next: PublicInfoValues = {
		...data,
		description: data.description === "" ? null : data.description,
		iconFileId: data.iconFileId === "" ? null : data.iconFileId,
	};
	if (
		next.mapImageFileIds &&
		new Set(next.mapImageFileIds).size !== next.mapImageFileIds.length
	) {
		throw Errors.invalidRequest("同じ画像を複数登録することはできません");
	}

	const before = await findBeforeOrEmpty(projectId);
	await assertCorrectionFilesUsable(
		userId,
		[
			...(next.iconFileId ? [next.iconFileId] : []),
			...(next.mapImageFileIds ?? []),
		],
		before
	);

	const beforeValues = valuesOf(before);
	// 値が変わった項目だけを修正として記録する
	const changedFields = projectPublicInfoFieldSchema.options.filter(field => {
		const key = projectPublicInfoFieldKeys[field];
		const value = next[key];
		return (
			value !== undefined &&
			JSON.stringify(beforeValues[key]) !== JSON.stringify(value)
		);
	});
	if (changedFields.length === 0) {
		return c.json({ project: await getProject(projectId) });
	}

	await prisma.$transaction(async tx => {
		const id =
			before.id ??
			(
				await tx.projectPublicInfo.create({
					data: { projectId },
					select: { id: true },
				})
			).id;
		await writeValues(tx, { ...before, id }, next);
		for (const field of changedFields) {
			await tx.projectPublicInfoModeration.upsert({
				where: {
					projectPublicInfoId_field_kind: {
						projectPublicInfoId: id,
						field,
						kind: "CORRECTED",
					},
				},
				// 再修正では修正前の値を変えず、企画の値を残し続ける
				update: { updatedById: userId },
				create: {
					projectPublicInfoId: id,
					field,
					kind: "CORRECTED",
					previousValue:
						beforeValues[projectPublicInfoFieldKeys[field]] ?? Prisma.JsonNull,
					updatedById: userId,
				},
			});
		}
	});
	bumpPublicApiCacheVersion();

	// 修正前の値として残していないファイルは、外れた時点で回収する
	await softDeleteUnreferencedFiles(
		fileIdsOf(beforeValues),
		fileIdsOf({ ...beforeValues, ...next })
	);

	return c.json({ project: await getProject(projectId) });
});

committeePublicInfoRoute.delete("/:projectId/corrections/:field", async c => {
	const { projectId, field } =
		revertCommitteePublicInfoCorrectionEndpoint.pathParams.parse(c.req.param());
	const before = await findBefore(projectId);
	const beforeValues = valuesOf(before);

	const restored = await prisma.$transaction(async tx => {
		const correction = await tx.projectPublicInfoModeration.findUnique({
			where: {
				projectPublicInfoId_field_kind: {
					projectPublicInfoId: before.id,
					field,
					kind: "CORRECTED",
				},
			},
			select: { id: true, previousValue: true },
		});
		if (!correction) throw Errors.notFound("修正の記録がありません");

		const key = projectPublicInfoFieldKeys[field];
		const values: PublicInfoValues = {
			[key]:
				toPreviousValue(correction.previousValue) ??
				(key === "description" || key === "iconFileId" ? null : []),
		};
		await writeValues(tx, before, values);
		await tx.projectPublicInfoModeration.delete({
			where: { id: correction.id },
		});
		return values;
	});
	bumpPublicApiCacheVersion();

	await softDeleteUnreferencedFiles(
		fileIdsOf(beforeValues),
		fileIdsOf({ ...beforeValues, ...restored })
	);

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
