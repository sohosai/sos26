import { Prisma } from "@prisma/client";
import type {
	CommitteeProjectPublicInfo,
	ProjectPublicInfoField,
} from "@sos26/shared";
import {
	correctCommitteePublicInfoEndpoint,
	hideCommitteePublicInfoFieldEndpoint,
	isImageMimeType,
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
import {
	committeeProjectPublicInfoSelect,
	lockProjectPublicInfo,
	previousFileIds,
	toCommitteeProjectPublicInfo,
	toPreviousValue,
} from "../lib/project-public-info";
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
		where: { kind: "CORRECTED" },
		select: { field: true, previousValue: true },
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

/** 修正前の値を、その項目の値として読む（未入力は項目に応じた空の値） */
function previousValueOf(
	field: ProjectPublicInfoField,
	previousValue: Prisma.JsonValue
): string | string[] | null {
	const empty =
		field === "DESCRIPTION" || field === "ICON" ? null : ([] as string[]);
	return toPreviousValue(previousValue) ?? empty;
}

/**
 * 修正で設定するファイルを検証する。
 *
 * 企画側の保存と同じく「実在する」「アップロード完了済み」「公開ファイル」「画像」を確認する。
 * アップロードした人は、操作した実委人本人に限る。ただし、すでにこの企画情報に付いている
 * ファイル（修正前の値として残しているものを含む）は問わない。
 */
async function assertCorrectionFilesUsable(
	tx: Prisma.TransactionClient,
	userId: string,
	fileIds: string[],
	before: BeforeInfo
): Promise<void> {
	if (fileIds.length === 0) return;

	const files = await tx.file.findMany({
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

	if (files.some(f => !isImageMimeType(f.mimeType))) {
		throw Errors.invalidRequest("画像ファイルのみ設定できます");
	}

	const attached = new Set([
		...fileIdsOf(valuesOf(before)),
		...before.moderations
			.filter(m => m.field === "ICON" || m.field === "MAP_IMAGES")
			.flatMap(m => previousFileIds(m.previousValue)),
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
async function findBeforeOrEmpty(
	tx: Prisma.TransactionClient,
	projectId: string
): Promise<BeforeInfo> {
	const project = await tx.project.findFirst({
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

async function findBefore(
	tx: Prisma.TransactionClient,
	projectId: string
): Promise<BeforeRow> {
	const before = await tx.projectPublicInfo.findFirst({
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
	const next: PublicInfoValues = { ...data };
	if (data.description === "") next.description = null;
	if (data.iconFileId === "") next.iconFileId = null;
	if (
		next.mapImageFileIds &&
		new Set(next.mapImageFileIds).size !== next.mapImageFileIds.length
	) {
		throw Errors.invalidRequest("同じ画像を複数登録することはできません");
	}

	const fileChange = await prisma.$transaction(async tx => {
		await lockProjectPublicInfo(tx, projectId);
		const before = await findBeforeOrEmpty(tx, projectId);
		await assertCorrectionFilesUsable(
			tx,
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
		if (changedFields.length === 0) return null;

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
			const key = projectPublicInfoFieldKeys[field];
			const correction = before.moderations.find(m => m.field === field);
			// 企画の入力と同じ値に戻した項目は、修正していない状態に戻す
			if (
				correction &&
				JSON.stringify(previousValueOf(field, correction.previousValue)) ===
					JSON.stringify(next[key])
			) {
				await tx.projectPublicInfoModeration.deleteMany({
					where: { projectPublicInfoId: id, field, kind: "CORRECTED" },
				});
				continue;
			}
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
					previousValue: beforeValues[key] ?? Prisma.JsonNull,
					updatedById: userId,
				},
			});
		}
		return {
			before: fileIdsOf(beforeValues),
			after: fileIdsOf({ ...beforeValues, ...next }),
		};
	});

	if (fileChange) {
		bumpPublicApiCacheVersion();
		// 修正前の値として残していないファイルは、外れた時点で回収する
		await softDeleteUnreferencedFiles(fileChange.before, fileChange.after);
	}

	return c.json({ project: await getProject(projectId) });
});

committeePublicInfoRoute.delete("/:projectId/corrections/:field", async c => {
	const { projectId, field } =
		revertCommitteePublicInfoCorrectionEndpoint.pathParams.parse(c.req.param());

	const fileChange = await prisma.$transaction(async tx => {
		await lockProjectPublicInfo(tx, projectId);
		const before = await findBefore(tx, projectId);
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

		const values: PublicInfoValues = {
			[projectPublicInfoFieldKeys[field]]: previousValueOf(
				field,
				correction.previousValue
			),
		};
		await writeValues(tx, before, values);
		await tx.projectPublicInfoModeration.delete({
			where: { id: correction.id },
		});
		const beforeValues = valuesOf(before);
		return {
			before: fileIdsOf(beforeValues),
			after: fileIdsOf({ ...beforeValues, ...values }),
		};
	});
	bumpPublicApiCacheVersion();

	await softDeleteUnreferencedFiles(fileChange.before, fileChange.after);

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
