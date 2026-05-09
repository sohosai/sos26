import { PassThrough, Readable } from "node:stream";
import type { CommitteeMember } from "@prisma/client";
import {
	addFormAttachmentRequestSchema,
	addFormCollaboratorRequestSchema,
	appendSuffixToPath,
	buildFormDownloadFileName,
	createFormRequestSchema,
	editFormAnswerPathParamsSchema,
	editFormAnswerRequestSchema,
	formAttachmentPathParamsSchema,
	formAuthorizationPathParamsSchema,
	formIdPathParamsSchema,
	formResponsePathParamsSchema,
	requestFormAuthorizationRequestSchema,
	sanitizeFileNameSegment,
	updateFormAuthorizationRequestSchema,
	updateFormDetailRequestSchema,
	updateFormViewersRequestSchema,
} from "@sos26/shared";
import archiver from "archiver";
import { Hono } from "hono";
import pLimit from "p-limit";
import { requirePermission } from "../lib/committee-permission";
import { Errors } from "../lib/error";
import {
	formAnswerFileSelect,
	mapAnswerFiles,
	normalizeFileIds,
} from "../lib/form-answer-files";
import {
	formAttachmentsInclude,
	mapFormAttachments,
} from "../lib/form-attachments";
import {
	constraintsToPrisma,
	mapFormToApiShape,
	mapItemToApiShape,
} from "../lib/form-constraints";
import {
	notifyFormAuthorizationCancelled,
	notifyFormAuthorizationDecided,
	notifyFormAuthorizationRequested,
} from "../lib/notifications";
import { prisma } from "../lib/prisma";
import { getObject } from "../lib/storage/presign";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeFormRoute = new Hono<AuthEnv>();

// 申請の存在確認 編集権限チェック
const answerFilesInclude = {
	where: {
		file: {
			status: "CONFIRMED" as const,
			deletedAt: null,
		},
	},
	orderBy: { sortOrder: "asc" as const },
	include: {
		file: { select: formAnswerFileSelect },
	},
};

const formAnswerFileWithKeySelect = {
	...formAnswerFileSelect,
	key: true,
} as const;

const answerFilesWithKeyInclude = {
	where: {
		file: {
			status: "CONFIRMED" as const,
			deletedAt: null,
		},
	},
	orderBy: { sortOrder: "asc" as const },
	include: {
		file: { select: formAnswerFileWithKeySelect },
	},
};

type ZipFileLink = {
	file: { key: string; fileName: string } | null;
};

type ZipAnswer = {
	formItemId: string;
	files: ZipFileLink[];
};

type ZipResponse = {
	formDelivery: {
		projectId: string;
		project: { number: number; name: string };
	};
	answers: ZipAnswer[];
};

type ZipHistory = {
	files: ZipFileLink[];
};

type ZipEntry = {
	name: string;
	key: string;
};

// 編集履歴がある場合は編集履歴を優先
function resolveAnswerFiles(
	answer: ZipAnswer,
	history: ZipHistory | undefined
): ZipFileLink[] {
	return history ? history.files : answer.files;
}

// ファイル名を重複しないように変更
function buildUniqueEntryName(params: {
	dirName: string;
	baseName: string;
	usedNames: Set<string>;
}): string {
	const { dirName, baseName, usedNames } = params;
	let entryName = `${dirName}/${baseName}`;
	let suffix = 1;
	while (usedNames.has(entryName)) {
		entryName = appendSuffixToPath(`${dirName}/${baseName}`, String(suffix));
		suffix += 1;
	}
	usedNames.add(entryName);
	return entryName;
}

// 回答に紐づくファイルをZipEntryに変換
function collectAnswerEntries(params: {
	answer: ZipAnswer;
	response: ZipResponse;
	formTitle: string;
	fileItemLabelMap: Map<string, string>;
	latestByCell: Map<string, ZipHistory>;
	usedNames: Set<string>;
}): ZipEntry[] {
	const {
		answer,
		response,
		formTitle,
		fileItemLabelMap,
		latestByCell,
		usedNames,
	} = params;
	const history = latestByCell.get(
		`${answer.formItemId}:${response.formDelivery.projectId}`
	);
	const files = resolveAnswerFiles(answer, history);
	if (files.length === 0) return [];

	const itemLabel = fileItemLabelMap.get(answer.formItemId) ?? "ファイル";
	const dirName = sanitizeFileNameSegment(itemLabel);

	return files.flatMap(fileLink => {
		const file = fileLink.file;
		if (!file) return [];

		const entryBaseName = buildFormDownloadFileName({
			projectNumber: response.formDelivery.project.number,
			formTitle,
			projectName: response.formDelivery.project.name,
			originalFileName: file.fileName,
		});

		const entryName = buildUniqueEntryName({
			dirName,
			baseName: entryBaseName,
			usedNames,
		});

		return [{ name: entryName, key: file.key }];
	});
}

function collectResponseEntries(params: {
	response: ZipResponse;
	formTitle: string;
	fileItemLabelMap: Map<string, string>;
	latestByCell: Map<string, ZipHistory>;
	usedNames: Set<string>;
}): ZipEntry[] {
	const { response, formTitle, fileItemLabelMap, latestByCell, usedNames } =
		params;
	return response.answers.flatMap(answer =>
		collectAnswerEntries({
			answer,
			response,
			formTitle,
			fileItemLabelMap,
			latestByCell,
			usedNames,
		})
	);
}

function collectZipEntries(params: {
	responses: ZipResponse[];
	latestByCell: Map<string, ZipHistory>;
	fileItemLabelMap: Map<string, string>;
	formTitle: string;
}): ZipEntry[] {
	const { responses, latestByCell, fileItemLabelMap, formTitle } = params;
	const usedNames = new Set<string>();
	return responses.flatMap(response =>
		collectResponseEntries({
			response,
			formTitle,
			fileItemLabelMap,
			latestByCell,
			usedNames,
		})
	);
}

async function appendZipEntriesWithLimit(
	archive: ReturnType<typeof archiver>,
	entries: ZipEntry[],
	concurrency: number
): Promise<void> {
	const limit = pLimit(concurrency);
	await Promise.all(
		entries.map(entry =>
			limit(async () => {
				const fileStream = await fetchFileStream(entry.key);
				archive.append(fileStream, { name: entry.name });
			})
		)
	);
}

async function fetchFileStream(key: string): Promise<Readable> {
	const s3Response = await getObject(key);
	const s3Body = s3Response.Body;
	if (!s3Body) {
		throw Errors.internal("ファイルの取得に失敗しました");
	}
	const readable = s3Body.transformToWebStream();
	return Readable.fromWeb(readable);
}

const getFormOrThrow = async (formId: string) => {
	const form = await prisma.form.findFirst({
		where: { id: formId, deletedAt: null },
		include: {
			items: { include: { options: true }, orderBy: { sortOrder: "asc" } },
		},
	});
	if (!form) throw Errors.notFound("申請が見つかりません");
	return form;
};

// 作成者 or 書き込み権限付き共同編集者
const requireWriteAccess = async (formId: string, userId: string) => {
	const form = await getFormOrThrow(formId);

	if (form.ownerId === userId) return form;

	const collaborator = await prisma.formCollaborator.findFirst({
		where: { formId, userId, isWrite: true, deletedAt: null },
	});
	if (!collaborator) throw Errors.forbidden("編集権限がありません");

	return form;
};

// 作成者のみ
const requireOwner = async (formId: string, userId: string) => {
	const form = await getFormOrThrow(formId);
	if (form.ownerId !== userId)
		throw Errors.forbidden("この操作は作成者のみ行えます");
	return form;
};

const userSelect = { id: true, name: true, avatarFileId: true } as const;

/** 承認済みの申請は編集不可 */
const requireNotApproved = async (formId: string) => {
	const approvedAuth = await prisma.formAuthorization.findFirst({
		where: { formId, status: "APPROVED" },
		select: { id: true },
	});
	if (approvedAuth) {
		throw Errors.invalidRequest("承認済みの申請は編集できません");
	}
};

/**
 * 回答閲覧権限チェック:
 * 1. owner → 閲覧可
 * 2. 共同編集者 → 閲覧可
 * 3. 閲覧者（FormViewer）にマッチ → 閲覧可
 */
async function canViewFormResponses(
	formId: string,
	userId: string,
	committeeMember: CommitteeMember
): Promise<boolean> {
	const form = await prisma.form.findFirst({
		where: { id: formId, deletedAt: null },
		include: {
			collaborators: { where: { deletedAt: null } },
		},
	});
	if (!form) return false;

	const viewers = await prisma.formViewer.findMany({
		where: { formId, deletedAt: null },
	});

	// 1. owner
	if (form.ownerId === userId) return true;

	// 2. collaborator
	if (form.collaborators.some(c => c.userId === userId)) return true;

	// 3. viewer
	for (const viewer of viewers) {
		if (viewer.scope === "ALL") return true;
		if (
			viewer.scope === "BUREAU" &&
			viewer.bureauValue === committeeMember.Bureau
		)
			return true;
		if (viewer.scope === "INDIVIDUAL" && viewer.userId === userId) return true;
	}

	return false;
}

// 承認時の配信スケジュール日時バリデーション
const validateApprovalSchedule = (
	scheduledSendAt: Date,
	deadlineAt: Date | null | undefined,
	now: Date
) => {
	if (scheduledSendAt <= now) {
		throw Errors.invalidRequest(
			"配信希望日時を過ぎているため承認できません。新しい日時で再申請してください"
		);
	}
	if (deadlineAt && scheduledSendAt >= deadlineAt) {
		throw Errors.invalidRequest(
			"配信希望日時と締め切り日時の順番が不正であるため承認できません。新しい日時で再申請してください"
		);
	}
};

// ─────────────────────────────────────────
// POST /committee/forms/create
// 申請を作成（項目・選択肢含め一括登録）
// ─────────────────────────────────────────
committeeFormRoute.post(
	"/create",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const body = await c.req.json().catch(() => ({}));
		const { items, ...formData } = createFormRequestSchema.parse(body);
		const userId = c.get("user").id;

		const form = await prisma.form.create({
			data: {
				...formData,
				ownerId: userId,
				items: {
					create: items.map(({ options, constraints, ...item }) => ({
						...item,
						...constraintsToPrisma(constraints),
						options: options?.length ? { create: options } : undefined,
					})),
				},
			},
			include: {
				items: { include: { options: true }, orderBy: { sortOrder: "asc" } },
			},
		});

		return c.json({ form: mapFormToApiShape(form) });
	}
);

// ─────────────────────────────────────────
// GET /committee/forms/list
// 申請一覧を取得（実委人全員閲覧可）
// ─────────────────────────────────────────
committeeFormRoute.get(
	"/list",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const committeeMember = c.get("committeeMember");

		const [forms, viewerEntries] = await Promise.all([
			prisma.form.findMany({
				where: { deletedAt: null },
				select: {
					id: true,
					title: true,
					description: true,
					updatedAt: true,
					owner: { select: userSelect },
					collaborators: {
						where: { deletedAt: null },
						select: {
							user: { select: userSelect },
						},
					},
					authorizations: {
						orderBy: { createdAt: "desc" },
						take: 1,
						select: {
							id: true,
							status: true,
							scheduledSendAt: true,
							allowLateResponse: true,
							deadlineAt: true,
							ownerOnly: true,
							requestedTo: { select: userSelect },
						},
					},
				},
				orderBy: { updatedAt: "desc" },
			}),
			prisma.formViewer.findMany({
				where: {
					deletedAt: null,
					form: { deletedAt: null },
					OR: [
						{ scope: "ALL" },
						{ scope: "BUREAU", bureauValue: committeeMember.Bureau },
						{ scope: "INDIVIDUAL", userId },
					],
				},
				select: { formId: true },
			}),
		]);

		const viewerFormIds = new Set(viewerEntries.map(v => v.formId));

		return c.json({
			forms: forms.map(f => ({
				...f,
				collaborators: f.collaborators.map(c => c.user),
				authorization: f.authorizations[0] ?? null,
				authorizations: undefined,
				isViewer: viewerFormIds.has(f.id),
			})),
		});
	}
);

// ─────────────────────────────────────────
// GET /committee/forms/:formId/detail
// 申請の詳細を取得（項目含む）
// ─────────────────────────────────────────
committeeFormRoute.get(
	"/:formId/detail",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = formIdPathParamsSchema.parse(c.req.param());

		const form = await prisma.form.findFirst({
			where: { id: formId, deletedAt: null },
			include: {
				owner: { select: userSelect },
				items: {
					include: {
						options: true,
					},
					orderBy: { sortOrder: "asc" },
				},
				collaborators: {
					where: { deletedAt: null },
					include: {
						user: { select: userSelect },
					},
				},
				attachments: formAttachmentsInclude,
				authorizations: {
					orderBy: { createdAt: "desc" },
					take: 1,
					include: {
						requestedBy: { select: userSelect },
						requestedTo: { select: userSelect },
						deliveries: {
							include: {
								project: { select: { id: true, name: true } },
							},
						},
					},
				},
			},
		});

		if (!form) {
			throw Errors.notFound("申請が見つかりません");
		}

		const viewers = await prisma.formViewer.findMany({
			where: { formId, deletedAt: null },
			include: { user: { select: userSelect } },
		});

		return c.json({
			form: {
				...form,
				items: form.items.map(mapItemToApiShape),
				attachments: mapFormAttachments(form.attachments),
				authorizationDetail: form.authorizations[0] ?? null,
				authorizations: undefined,
				viewers: viewers.map(v => ({
					id: v.id,
					scope: v.scope,
					bureauValue: v.bureauValue,
					createdAt: v.createdAt,
					user: v.user,
				})),
			},
		});
	}
);

// ─────────────────────────────────────────
// PATCH /committee/forms/:formId/detail
// 申請を更新
// ─────────────────────────────────────────
committeeFormRoute.patch(
	"/:formId/detail",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const userId = c.get("user").id;

		await requireWriteAccess(formId, userId);

		const body = await c.req.json().catch(() => ({}));
		const { items, ...formData } = updateFormDetailRequestSchema.parse(body);

		const form = await prisma.$transaction(
			// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: 申請更新のトランザクション処理
			async tx => {
				const approvedAuth = await tx.formAuthorization.findFirst({
					where: { formId, status: "APPROVED" },
				});
				if (approvedAuth) {
					throw Errors.invalidRequest("承認済みの申請は編集できません");
				}

				await tx.form.update({ where: { id: formId }, data: formData });

				if (items !== undefined) {
					const existingItems = await tx.formItem.findMany({
						where: { formId },
						select: { id: true },
					});

					const existingIds = new Set(existingItems.map(i => i.id));
					const submittedIds = new Set(
						items.flatMap(i => (i.id && existingIds.has(i.id) ? [i.id] : []))
					);

					// 回答が存在するアイテムIDを一括取得
					const answeredItems = await tx.formAnswer.groupBy({
						by: ["formItemId"],
						where: { formItemId: { in: [...existingIds] } },
					});
					const answeredItemIds = new Set(answeredItems.map(a => a.formItemId));

					// 送信されなかったitemは回答があればエラー、なければ物理削除
					const removedIds = [...existingIds].filter(
						id => !submittedIds.has(id)
					);
					const removedWithAnswers = removedIds.filter(id =>
						answeredItemIds.has(id)
					);
					if (removedWithAnswers.length > 0) {
						throw Errors.invalidRequest("回答が存在する項目は削除できません");
					}
					if (removedIds.length > 0) {
						await tx.formItem.deleteMany({
							where: { id: { in: removedIds } },
						});
					}

					// 既存itemを更新 / 新規itemを作成
					for (const [
						index,
						{ id, options, constraints, ...item },
					] of items.entries()) {
						if (id && existingIds.has(id)) {
							if (options && answeredItemIds.has(id)) {
								throw Errors.invalidRequest(
									"回答が存在する項目の選択肢は変更できません"
								);
							}

							await tx.formItem.update({
								where: { id },
								data: {
									...item,
									...constraintsToPrisma(constraints),
									sortOrder: index,
									options: answeredItemIds.has(id)
										? undefined
										: {
												deleteMany: {},
												create: (options ?? []).map((opt, i) => ({
													label: opt.label,
													sortOrder: i,
												})),
											},
								},
							});
						} else {
							await tx.formItem.create({
								data: {
									...item,
									...constraintsToPrisma(constraints),
									formId,
									sortOrder: index,
									options: options?.length
										? {
												create: options.map((opt, i) => ({
													label: opt.label,
													sortOrder: i,
												})),
											}
										: undefined,
								},
							});
						}
					}
				}

				return tx.form.findUniqueOrThrow({
					where: { id: formId },
					include: {
						items: {
							include: { options: true },
							orderBy: { sortOrder: "asc" },
						},
					},
				});
			},
			{ isolationLevel: "Serializable" }
		);

		return c.json({ form: mapFormToApiShape(form) });
	}
);

// ─────────────────────────────────────────
// DELETE /committee/forms/:formId
// 申請を論理削除
// ─────────────────────────────────────────
committeeFormRoute.delete(
	"/:formId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const userId = c.get("user").id;

		await requireOwner(formId, userId);

		const now = new Date();

		await prisma.$transaction([
			prisma.form.update({
				where: { id: formId },
				data: { deletedAt: now },
			}),
			prisma.formAuthorization.updateMany({
				where: { formId, status: "PENDING" },
				data: { status: "REJECTED", decidedAt: now },
			}),
		]);

		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────────────────────────
// 共同編集者
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────
// POST /committee/forms/:formId/collaborators/:userId
// 共同編集者を追加
// ─────────────────────────────────────────
committeeFormRoute.post(
	"/:formId/collaborators/:userId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const { userId: targetUserId } = c.req.param();
		const userId = c.get("user").id;

		await requireOwner(formId, userId);

		// 自分自身は追加不可
		if (targetUserId === userId) {
			throw Errors.invalidRequest(
				"作成者を共同編集者に追加することはできません"
			);
		}

		// 追加対象ユーザーの存在確認 + 委員会メンバーであることを確認
		const targetUser = await prisma.user.findFirst({
			where: {
				id: targetUserId,
				deletedAt: null,
				committeeMember: { deletedAt: null },
			},
		});
		if (!targetUser)
			throw Errors.notFound(
				"ユーザーが見つからないか、委員会メンバーではありません"
			);

		// 既存チェック（ソフトデリート済みも含めて検索）
		const body = await c.req.json().catch(() => ({}));
		const data = addFormCollaboratorRequestSchema.parse(body);

		const collaborator = await prisma.$transaction(
			async tx => {
				const existing = await tx.formCollaborator.findFirst({
					where: { formId, userId: targetUserId },
				});
				if (existing) {
					if (!existing.deletedAt)
						throw Errors.alreadyExists("既に共同編集者です");

					// ソフトデリート済み → 再有効化
					return tx.formCollaborator.update({
						where: { id: existing.id },
						data: { deletedAt: null, isWrite: data.isWrite },
					});
				}

				return tx.formCollaborator.create({
					data: { formId, userId: targetUserId, isWrite: data.isWrite },
				});
			},
			{ isolationLevel: "Serializable" }
		);

		return c.json({ collaborator });
	}
);

// ─────────────────────────────────────────
// DELETE /committee/forms/:formId/collaborators/:userId
// 共同編集者を削除
// ─────────────────────────────────────────
committeeFormRoute.delete(
	"/:formId/collaborators/:userId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const { userId: targetUserId } = c.req.param();
		const userId = c.get("user").id;

		await requireOwner(formId, userId);

		const collaborator = await prisma.formCollaborator.findFirst({
			where: { formId, userId: targetUserId, deletedAt: null },
		});
		if (!collaborator)
			throw Errors.notFound("対象ユーザーは共同編集者ではありません");

		await prisma.formCollaborator.update({
			where: { id: collaborator.id },
			data: { deletedAt: new Date() },
		});

		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────
// POST /committee/forms/:formId/attachments
// 添付ファイルを追加
// ─────────────────────────────────────────
committeeFormRoute.post(
	"/:formId/attachments",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const userId = c.get("user").id;
		await requireWriteAccess(formId, userId);

		await requireNotApproved(formId);

		const body = await c.req.json().catch(() => ({}));
		const { fileIds } = addFormAttachmentRequestSchema.parse(body);
		const uniqueFileIds = [...new Set(fileIds)];

		const files = await prisma.file.findMany({
			where: {
				id: { in: uniqueFileIds },
				status: "CONFIRMED",
				deletedAt: null,
			},
			select: { id: true },
		});
		if (files.length !== uniqueFileIds.length) {
			throw Errors.invalidRequest(
				"指定されたファイルの一部が存在しないか、アップロードが未完了です"
			);
		}

		const attachments = await Promise.all(
			uniqueFileIds.map(fileId =>
				prisma.formAttachment.upsert({
					where: { formId_fileId: { formId, fileId } },
					create: { formId, fileId },
					update: { deletedAt: null },
					include: formAttachmentsInclude.include,
				})
			)
		);

		return c.json(
			{
				attachments: mapFormAttachments(attachments),
			},
			201
		);
	}
);

// ─────────────────────────────────────────
// DELETE /committee/forms/:formId/attachments/:attachmentId
// 添付ファイルを削除
// ─────────────────────────────────────────
committeeFormRoute.delete(
	"/:formId/attachments/:attachmentId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId, attachmentId } = formAttachmentPathParamsSchema.parse({
			formId: c.req.param("formId"),
			attachmentId: c.req.param("attachmentId"),
		});
		const userId = c.get("user").id;
		await requireWriteAccess(formId, userId);

		await requireNotApproved(formId);

		const attachment = await prisma.formAttachment.findFirst({
			where: { id: attachmentId, formId, deletedAt: null },
			select: { id: true },
		});
		if (!attachment) {
			throw Errors.notFound("添付ファイルが見つかりません");
		}

		await prisma.formAttachment.update({
			where: { id: attachmentId },
			data: { deletedAt: new Date() },
		});

		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────────────────────────
// 承認フロー
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────
// POST /committee/forms/:formId/authorizations
// 承認依頼をリクエスト
// ─────────────────────────────────────────
committeeFormRoute.post(
	"/:formId/authorizations",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const user = c.get("user");
		const userId = user.id;

		const form = await requireWriteAccess(formId, userId);

		const body = await c.req.json().catch(() => ({}));
		const { deliveryTarget, requestedToId, ...data } =
			requestFormAuthorizationRequestSchema.parse(body);

		// 承認依頼先ユーザーの存在確認
		const requestedTo = await prisma.user.findFirst({
			where: { id: requestedToId, deletedAt: null },
		});
		if (!requestedTo)
			throw Errors.notFound("承認依頼先のユーザーが見つかりません");

		// 承認依頼先が実委人かつ FORM_DELIVER 権限を持っているか確認
		const committeeMember = await prisma.committeeMember.findFirst({
			where: {
				userId: requestedToId,
				deletedAt: null,
				permissions: {
					some: { permission: "FORM_DELIVER" },
				},
			},
		});
		if (!committeeMember) {
			throw Errors.invalidRequest(
				"承認依頼先のユーザーに申請配信権限がありません"
			);
		}

		const now = new Date();
		// scheduledSendAt が未来であること
		if (data.scheduledSendAt && data.scheduledSendAt <= now) {
			throw Errors.invalidRequest("配信希望日時は未来の日時を指定してください");
		} else if (data.deadlineAt && data.scheduledSendAt >= data.deadlineAt) {
			throw Errors.invalidRequest("配信希望日時と締め切り日時の順番が不正です");
		}

		// 個別指定モードの場合、配信先企画の存在確認
		if (deliveryTarget.mode === "INDIVIDUAL") {
			const projects = await prisma.project.findMany({
				where: { id: { in: deliveryTarget.projectIds }, deletedAt: null },
			});
			if (projects.length !== deliveryTarget.projectIds.length) {
				throw Errors.notFound("指定された企画の一部が見つかりません");
			}
		}

		const authorization = await prisma.$transaction(
			async tx => {
				const existingAuth = await tx.formAuthorization.findFirst({
					where: { formId, status: { in: ["PENDING", "APPROVED"] } },
				});

				if (existingAuth) {
					if (existingAuth.status === "APPROVED") {
						throw Errors.invalidRequest("この申請は既に承認されています");
					}
					throw Errors.alreadyExists("既に承認待ちの申請があります");
				}

				if (deliveryTarget.mode === "INDIVIDUAL") {
					return tx.formAuthorization.create({
						data: {
							formId,
							requestedById: userId,
							requestedToId,
							...data,
							deliveryMode: "INDIVIDUAL",
							deliveries: {
								create: deliveryTarget.projectIds.map(projectId => ({
									projectId,
								})),
							},
						},
					});
				}

				// カテゴリ指定モード: フィルタ条件を保存するのみ
				return tx.formAuthorization.create({
					data: {
						formId,
						requestedById: userId,
						requestedToId,
						...data,
						deliveryMode: "CATEGORY",
						filterTypes: deliveryTarget.projectTypes,
						filterLocations: deliveryTarget.projectLocations,
					},
				});
			},
			{ isolationLevel: "Serializable" }
		);

		void notifyFormAuthorizationRequested({
			approverUserId: requestedToId,
			requesterName: user.name,
			formId,
			formTitle: form.title,
			scheduledSendAt: authorization.scheduledSendAt,
		});

		return c.json({ authorization });
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /committee/forms/:formId/authorizations/:authorizationId
// 承認 / 却下 / 承認取り消し（requestedTo 本人のみ）
// ─────────────────────────────────────────────────────────────
committeeFormRoute.patch(
	"/:formId/authorizations/:authorizationId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const user = c.get("user");
		const { formId, authorizationId } = formAuthorizationPathParamsSchema.parse(
			{
				formId: c.req.param("formId"),
				authorizationId: c.req.param("authorizationId"),
			}
		);
		const body = await c.req.json().catch(() => ({}));
		const { status } = updateFormAuthorizationRequestSchema.parse(body);

		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: 単純なチェック分岐のみのため見通しを優先
		const { updated, authorization } = await prisma.$transaction(async tx => {
			const authorization = await tx.formAuthorization.findFirst({
				where: { id: authorizationId, formId },
				include: { form: { select: { deletedAt: true, title: true } } },
			});

			if (!authorization) throw Errors.notFound("承認依頼が見つかりません");

			if (authorization.form.deletedAt)
				throw Errors.invalidRequest("削除済みの申請は承認できません");

			if (authorization.requestedToId !== user.id)
				throw Errors.forbidden("この承認依頼を操作する権限がありません");

			// 承認依頼作成後に FORM_DELIVER 権限が剥奪されていないか再確認
			await requirePermission(
				tx,
				user.id,
				"FORM_DELIVER",
				"申請承認権限がありません"
			);

			const now = new Date();

			if (authorization.status === "PENDING") {
				// 承認する場合、スケジュール日時を検証
				if (status === "APPROVED") {
					validateApprovalSchedule(
						authorization.scheduledSendAt,
						authorization.deadlineAt,
						now
					);
				}

				const updated = await tx.formAuthorization.update({
					where: { id: authorizationId, status: "PENDING" },
					data: { status, decidedAt: now },
				});

				return { updated, authorization };
			}

			if (authorization.status === "APPROVED" && status === "REJECTED") {
				if (authorization.scheduledSendAt <= now) {
					throw Errors.invalidRequest(
						"公開予定日時を過ぎているため承認を取り消せません"
					);
				}

				const updated = await tx.formAuthorization.update({
					where: { id: authorizationId, status: "APPROVED" },
					data: {
						status: "REJECTED",
						decidedAt: now,
						deliveryNotifiedAt: null,
					},
				});

				return { updated, authorization };
			}

			throw Errors.invalidRequest("この承認依頼は既に処理済みです");
		});

		// 承認が取り消された場合は別の通知を送信
		if (authorization.status === "APPROVED" && status === "REJECTED") {
			void notifyFormAuthorizationCancelled({
				requestedByUserId: authorization.requestedById,
				formId,
				formTitle: authorization.form.title,
			});
		} else {
			void notifyFormAuthorizationDecided({
				requestedByUserId: authorization.requestedById,
				formId,
				formTitle: authorization.form.title,
				status,
				scheduledSendAt: authorization.scheduledSendAt,
			});
		}

		return c.json({ authorization: updated });
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/forms/:formId/responses
// 回答一覧（owner または共同編集者のみ）
// ─────────────────────────────────────────────────────────────
committeeFormRoute.get(
	"/:formId/responses",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const userId = c.get("user").id;
		const committeeMember = c.get("committeeMember");

		// owner, 共同編集者, または閲覧者のみ閲覧可
		if (!(await canViewFormResponses(formId, userId, committeeMember))) {
			throw Errors.forbidden("回答の閲覧権限がありません");
		}

		const responses = await prisma.formResponse.findMany({
			where: {
				formDelivery: { formAuthorization: { formId } },
				submittedAt: { not: null }, // 提出済みのみ
			},
			include: {
				respondent: { select: userSelect },
				formDelivery: {
					include: {
						project: {
							select: {
								id: true,
								number: true,
								name: true,
							},
						},
					},
				},
				answers: {
					include: {
						files: answerFilesInclude,
						selectedOptions: {
							include: {
								formItemOption: { select: { id: true, label: true } },
							},
						},
					},
				},
			},
			orderBy: { submittedAt: "desc" },
		});

		// FormItemEditHistory の最新値を取得
		const formItems = await prisma.formItem.findMany({
			where: { formId },
			select: { id: true },
		});
		const formItemIds = formItems.map(fi => fi.id);
		const projectIds = [
			...new Set(responses.map(r => r.formDelivery.projectId)),
		];

		const allHistory =
			formItemIds.length && projectIds.length
				? await prisma.formItemEditHistory.findMany({
						where: {
							formItemId: { in: formItemIds },
							projectId: { in: projectIds },
						},
						orderBy: { createdAt: "desc" },
						include: {
							files: answerFilesInclude,
							selectedOptions: {
								include: {
									formItemOption: { select: { id: true, label: true } },
								},
							},
						},
					})
				: [];

		const latestByCell = new Map<string, (typeof allHistory)[0]>();
		for (const h of allHistory) {
			const key = `${h.formItemId}:${h.projectId}`;
			if (!latestByCell.has(key)) latestByCell.set(key, h);
		}

		return c.json({
			responses: responses.map(r => ({
				id: r.id,
				respondent: r.respondent,
				project: {
					id: r.formDelivery.project.id,
					number: r.formDelivery.project.number,
					name: r.formDelivery.project.name,
				},
				submittedAt: r.submittedAt,
				createdAt: r.createdAt,
				answers: r.answers.map(a => {
					const history = latestByCell.get(
						`${a.formItemId}:${r.formDelivery.projectId}`
					);
					if (history) {
						return {
							formItemId: a.formItemId,
							textValue: history.textValue,
							numberValue: history.numberValue,
							files: mapAnswerFiles(history.files),
							selectedOptions: history.selectedOptions.map(s => ({
								id: s.formItemOption.id,
								label: s.formItemOption.label,
							})),
						};
					}
					return {
						formItemId: a.formItemId,
						textValue: a.textValue,
						numberValue: a.numberValue,
						files: mapAnswerFiles(a.files),
						selectedOptions: a.selectedOptions.map(s => ({
							id: s.formItemOption.id,
							label: s.formItemOption.label,
						})),
					};
				}),
			})),
		});
	}
);

// ─────────────────────────────────────────
// GET /committee/forms/:formId/responses/files.zip
// 回答のファイルをまとめてダウンロード
// ─────────────────────────────────────────
committeeFormRoute.get(
	"/:formId/responses/files.zip",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const userId = c.get("user").id;
		const committeeMember = c.get("committeeMember");

		if (!(await canViewFormResponses(formId, userId, committeeMember))) {
			throw Errors.forbidden("回答の閲覧権限がありません");
		}

		const form = await prisma.form.findFirst({
			where: { id: formId, deletedAt: null },
			select: {
				title: true,
				items: { select: { id: true, label: true, type: true } },
			},
		});
		if (!form) throw Errors.notFound("申請が見つかりません");

		const fileItems = form.items.filter(item => item.type === "FILE");
		const fileItemIds = fileItems.map(item => item.id);
		const fileItemLabelMap = new Map(
			fileItems.map(item => [item.id, item.label])
		);

		const responses = await prisma.formResponse.findMany({
			where: {
				formDelivery: { formAuthorization: { formId } },
				submittedAt: { not: null },
			},
			include: {
				formDelivery: {
					include: {
						project: {
							select: { id: true, number: true, name: true },
						},
					},
				},
				answers: {
					where: fileItemIds.length ? { formItemId: { in: fileItemIds } } : {},
					include: { files: answerFilesWithKeyInclude },
				},
			},
			orderBy: { submittedAt: "desc" },
		});

		const projectIds = [
			...new Set(responses.map(r => r.formDelivery.projectId)),
		];
		const allHistory =
			fileItemIds.length && projectIds.length
				? await prisma.formItemEditHistory.findMany({
						where: {
							formItemId: { in: fileItemIds },
							projectId: { in: projectIds },
						},
						orderBy: { createdAt: "desc" },
						include: { files: answerFilesWithKeyInclude },
					})
				: [];

		const latestByCell = new Map<string, (typeof allHistory)[0]>();
		for (const h of allHistory) {
			const key = `${h.formItemId}:${h.projectId}`;
			if (!latestByCell.has(key)) latestByCell.set(key, h);
		}

		const archive = archiver("zip", { zlib: { level: 6 } });
		const stream = new PassThrough();
		archive.on("error", (error: Error | undefined) => {
			stream.destroy(error);
		});
		archive.pipe(stream);

		void (async () => {
			const entries = collectZipEntries({
				responses,
				latestByCell,
				fileItemLabelMap,
				formTitle: form.title,
			});
			await appendZipEntriesWithLimit(archive, entries, 5);
			await archive.finalize();
		})().catch(error => {
			const err =
				error instanceof Error ? error : new Error("ZIPの生成に失敗しました");
			archive.destroy(err);
		});
		const downloadName = `${sanitizeFileNameSegment(form.title)}_files.zip`;
		const encodedFileName = encodeURIComponent(downloadName);
		c.header("Content-Type", "application/zip");
		c.header(
			"Content-Disposition",
			`attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`
		);

		return c.body(Readable.toWeb(stream));
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/forms/:formId/responses/:responseId
// 回答詳細（owner または共同編集者のみ）
// ─────────────────────────────────────────────────────────────
committeeFormRoute.get(
	"/:formId/responses/:responseId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId, responseId } = formResponsePathParamsSchema.parse(
			c.req.param()
		);
		const userId = c.get("user").id;
		const committeeMember = c.get("committeeMember");

		// owner, 共同編集者, または閲覧者のみ閲覧可
		if (!(await canViewFormResponses(formId, userId, committeeMember))) {
			throw Errors.forbidden("回答の閲覧権限がありません");
		}

		const r = await prisma.formResponse.findFirst({
			where: {
				id: responseId,
				formDelivery: { formAuthorization: { formId } },
				submittedAt: { not: null },
			},
			include: {
				respondent: { select: userSelect },
				formDelivery: {
					include: {
						project: { select: { id: true, number: true, name: true } },
					},
				},
				answers: {
					include: {
						files: answerFilesInclude,
						selectedOptions: {
							include: {
								formItemOption: { select: { id: true, label: true } },
							},
						},
					},
				},
			},
		});
		if (!r) throw Errors.notFound("回答が見つかりません");

		// FormItemEditHistory の最新値を取得
		const formItemIds = r.answers.map(a => a.formItemId);
		const projectId = r.formDelivery.project.id;
		const allHistory = formItemIds.length
			? await prisma.formItemEditHistory.findMany({
					where: {
						formItemId: { in: formItemIds },
						projectId,
					},
					orderBy: { createdAt: "desc" },
					include: {
						files: answerFilesInclude,
						selectedOptions: {
							include: {
								formItemOption: { select: { id: true, label: true } },
							},
						},
					},
				})
			: [];

		const latestByItem = new Map<string, (typeof allHistory)[0]>();
		for (const h of allHistory) {
			if (!latestByItem.has(h.formItemId)) latestByItem.set(h.formItemId, h);
		}

		return c.json({
			response: {
				id: r.id,
				respondent: r.respondent,
				project: {
					id: r.formDelivery.project.id,
					number: r.formDelivery.project.number,
					name: r.formDelivery.project.name,
				},
				submittedAt: r.submittedAt,
				createdAt: r.createdAt,
				answers: r.answers.map(a => {
					const history = latestByItem.get(a.formItemId);
					if (history) {
						return {
							formItemId: a.formItemId,
							textValue: history.textValue,
							numberValue: history.numberValue,
							files: mapAnswerFiles(history.files),
							selectedOptions: history.selectedOptions.map(s => ({
								id: s.formItemOption.id,
								label: s.formItemOption.label,
							})),
						};
					}
					return {
						formItemId: a.formItemId,
						textValue: a.textValue,
						numberValue: a.numberValue,
						files: mapAnswerFiles(a.files),
						selectedOptions: a.selectedOptions.map(s => ({
							id: s.formItemOption.id,
							label: s.formItemOption.label,
						})),
					};
				}),
			},
		});
	}
);

// ─────────────────────────────────────────────────────────────
// PUT /committee/forms/:formId/answers/:formItemId/:projectId
// 申請回答の編集（作成者 or 共同編集者のみ）
// ─────────────────────────────────────────────────────────────

committeeFormRoute.put(
	"/:formId/answers/:formItemId/:projectId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const { formId, formItemId, projectId } =
			editFormAnswerPathParamsSchema.parse(c.req.param());

		// 作成者 or 共同編集者のみ編集可（閲覧者は不可）
		const form = await prisma.form.findFirst({
			where: { id: formId, deletedAt: null },
			include: {
				collaborators: { where: { deletedAt: null } },
				items: { include: { options: true } },
			},
		});
		if (!form) throw Errors.notFound("申請が見つかりません");

		const isOwner = form.ownerId === userId;
		const isWriteCollaborator = form.collaborators.some(
			c => c.userId === userId && c.isWrite
		);
		if (!isOwner && !isWriteCollaborator) {
			throw Errors.forbidden("回答の編集権限がありません");
		}

		// formItemId がこの form に属しているか確認
		const formItem = form.items.find(item => item.id === formItemId);
		if (!formItem)
			throw Errors.invalidRequest("この申請に属する項目ではありません");

		const project = await prisma.project.findFirst({
			where: { id: projectId, deletedAt: null },
		});
		if (!project) throw Errors.notFound("企画が見つかりません");

		const body = await c.req.json().catch(() => ({}));
		const data = editFormAnswerRequestSchema.parse(body);

		// 未回答（未提出 かつ 履歴なし）は編集不可
		const [response, latestHistory] = await Promise.all([
			prisma.formResponse.findFirst({
				where: {
					formDelivery: {
						projectId,
						formAuthorization: {
							form: { items: { some: { id: formItemId } } },
						},
					},
					submittedAt: { not: null },
				},
				select: { id: true },
			}),
			prisma.formItemEditHistory.findFirst({
				where: { formItemId, projectId },
				select: { id: true },
			}),
		]);
		if (!response && !latestHistory) {
			throw Errors.invalidRequest(
				"未回答の企画は編集できません。提出後に編集してください"
			);
		}

		const history = await prisma.$transaction(
			async tx => {
				const created = await tx.formItemEditHistory.create({
					data: {
						formItemId,
						projectId,
						textValue: data.textValue ?? null,
						numberValue: data.numberValue ?? null,
						actorId: userId,
						trigger: "COMMITTEE_EDIT",
					},
				});

				const fileIds = normalizeFileIds(data.fileIds);
				if (fileIds.length > 0) {
					await tx.formItemEditHistoryFile.createMany({
						data: fileIds.map((fileId, sortOrder) => ({
							editHistoryId: created.id,
							fileId,
							sortOrder,
						})),
					});
				}

				if (data.selectedOptionIds?.length) {
					const validIds = new Set(formItem.options.map(o => o.id));
					const invalid = data.selectedOptionIds.filter(
						id => !validIds.has(id)
					);
					if (invalid.length > 0)
						throw Errors.invalidRequest("無効な選択肢が含まれています");

					await tx.formItemEditHistorySelectedOption.createMany({
						data: data.selectedOptionIds.map(optionId => ({
							editHistoryId: created.id,
							formItemOptionId: optionId,
						})),
					});
				}

				return tx.formItemEditHistory.findUniqueOrThrow({
					where: { id: created.id },
					include: {
						files: answerFilesInclude,
						selectedOptions: {
							include: {
								formItemOption: { select: { id: true, label: true } },
							},
						},
					},
				});
			},
			{ isolationLevel: "Serializable" }
		);

		return c.json({
			answer: {
				formItemId,
				textValue: history.textValue,
				numberValue: history.numberValue,
				files: mapAnswerFiles(history.files),
				selectedOptions: history.selectedOptions.map(s => ({
					id: s.formItemOption.id,
					label: s.formItemOption.label,
				})),
			},
		});
	}
);

// ─────────────────────────────────────────────────────────────
// PUT /committee/forms/:formId/viewers
// 閲覧者設定（作成者 or 書き込み権限付き共同編集者のみ）
// 既存の閲覧者を全削除して新規作成
// ─────────────────────────────────────────────────────────────
committeeFormRoute.put(
	"/:formId/viewers",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const { formId } = formIdPathParamsSchema.parse(c.req.param());
		const userId = c.get("user").id;

		await requireWriteAccess(formId, userId);

		const body = await c.req.json().catch(() => ({}));
		const { viewers: viewerInputs } =
			updateFormViewersRequestSchema.parse(body);

		// トランザクションで全削除→新規作成
		const viewers = await prisma.$transaction(async tx => {
			await tx.formViewer.deleteMany({ where: { formId } });

			const created = await Promise.all(
				viewerInputs.map(input =>
					tx.formViewer.create({
						data: {
							formId,
							scope: input.scope,
							bureauValue: input.bureauValue ?? null,
							userId: input.userId ?? null,
						},
						include: { user: { select: userSelect } },
					})
				)
			);

			return created;
		});

		return c.json({
			viewers: viewers.map(v => ({
				id: v.id,
				scope: v.scope,
				bureauValue: v.bureauValue,
				createdAt: v.createdAt,
				user: v.user,
			})),
		});
	}
);

export { committeeFormRoute };
