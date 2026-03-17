import type { ProjectLocation, ProjectType } from "@prisma/client";
import {
	type CreateFormResponseRequest,
	createFormResponseRequestSchema,
	type FormItemType,
	PATTERN_LABELS,
	PATTERN_REGEXES,
	projectFormPathParamsSchema,
	updateFormResponseRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import {
	formAnswerFileSelect,
	mapAnswerFiles,
	normalizeFileIds,
} from "../lib/form-answer-files";
import {
	assertFileCountConstraints,
	assertFormAnswersValid,
	assertRequiredAnswered,
} from "../lib/form-answer-validation";
import {
	constraintsFromPrisma,
	mapItemToApiShape,
} from "../lib/form-constraints";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const projectFormRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// ヘルパー: FormDelivery の存在確認
// ─────────────────────────────────────────────────────────────

const getDeliveryOrThrow = async (
	projectId: string,
	formDeliveryId: string
) => {
	const now = new Date();
	const delivery = await prisma.formDelivery.findFirst({
		where: {
			id: formDeliveryId,
			projectId,
			formAuthorization: {
				status: "APPROVED",
				scheduledSendAt: {
					lte: now,
				},
				form: { deletedAt: null },
			},
		},
		include: {
			formAuthorization: {
				include: {
					form: {
						include: {
							items: {
								select: {
									id: true,
									label: true,
									description: true,
									type: true,
									required: true,
									sortOrder: true,
									options: true,
									constraintMinLength: true,
									constraintMaxLength: true,
									constraintPattern: true,
									constraintCustomPattern: true,
									constraintMinFiles: true,
									constraintMaxFiles: true,
								},
								orderBy: { sortOrder: "asc" },
							},
						},
					},
				},
			},
		},
	});
	if (!delivery) throw Errors.notFound("フォームが見つかりません");
	return delivery;
};
// ─────────────────────────────────────────────────────────────
// ヘルパー: 回答期限チェック
// ─────────────────────────────────────────────────────────────

const checkDeadline = (auth: {
	deadlineAt: Date | null;
	allowLateResponse: boolean;
}) => {
	if (!auth.deadlineAt) return; // 期限なし
	if (auth.allowLateResponse) return; // 遅延提出許可あり
	if (auth.deadlineAt <= new Date()) {
		throw Errors.invalidRequest("回答期限を過ぎています");
	}
};

// ─────────────────────────────────────────────────────────────
// ヘルパー: 回答のupsert
// ─────────────────────────────────────────────────────────────

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

const upsertAnswers = async (
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
	responseId: string,
	answers: CreateFormResponseRequest["answers"]
) => {
	// 既存回答を全削除して再作成（シンプルな全置き換え）
	await tx.formAnswer.deleteMany({ where: { formResponseId: responseId } });

	for (const answer of answers) {
		await tx.formAnswer.create({
			data: {
				formResponseId: responseId,
				formItemId: answer.formItemId,
				textValue:
					answer.type === "TEXT" || answer.type === "TEXTAREA"
						? (answer.textValue ?? null)
						: null,
				numberValue:
					answer.type === "NUMBER" ? (answer.numberValue ?? null) : null,
				files:
					answer.type === "FILE" && answer.fileIds.length > 0
						? {
								create: normalizeFileIds(answer.fileIds).map(
									(fileId, sortOrder) => ({
										fileId,
										sortOrder,
									})
								),
							}
						: undefined,
				selectedOptions:
					answer.type === "SELECT" || answer.type === "CHECKBOX"
						? {
								create: (answer.selectedOptionIds ?? []).map(id => ({
									formItemOptionId: id,
								})),
							}
						: undefined,
			},
		});
	}
};

const formatResponse = async (
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
	responseId: string
) => {
	const response = await tx.formResponse.findUniqueOrThrow({
		where: { id: responseId },
		include: {
			answers: {
				include: {
					selectedOptions: true,
					files: answerFilesInclude,
				},
			},
		},
	});

	return {
		id: response.id,
		submittedAt: response.submittedAt,
		answers: response.answers.map(a => ({
			formItemId: a.formItemId,
			textValue: a.textValue,
			numberValue: a.numberValue,
			files: mapAnswerFiles(a.files),
			selectedOptionIds: a.selectedOptions.map(s => s.formItemOptionId),
		})),
	};
};

function resolveConstraintRegex(
	pattern: string,
	customPattern: string | null
): RegExp | null {
	if (pattern === "custom") {
		if (!customPattern) return null;
		try {
			return new RegExp(customPattern);
		} catch {
			return null;
		}
	}
	return PATTERN_REGEXES[pattern] ?? null;
}

function assertItemTextConstraints(
	item: {
		constraintMinLength: number | null;
		constraintMaxLength: number | null;
		constraintPattern: string | null;
		constraintCustomPattern: string | null;
	},
	value: string
) {
	const {
		constraintMinLength,
		constraintMaxLength,
		constraintPattern,
		constraintCustomPattern,
	} = item;

	if (constraintMinLength !== null && value.length < constraintMinLength) {
		throw Errors.invalidRequest(
			`${constraintMinLength}文字以上で入力してください`
		);
	}

	if (constraintMaxLength !== null && value.length > constraintMaxLength) {
		throw Errors.invalidRequest(
			`${constraintMaxLength}文字以内で入力してください`
		);
	}

	if (constraintPattern !== null) {
		const regex = resolveConstraintRegex(
			constraintPattern,
			constraintCustomPattern
		);
		if (regex && !regex.test(value)) {
			const label =
				constraintPattern === "custom"
					? `パターン（${constraintCustomPattern}）`
					: (PATTERN_LABELS[constraintPattern] ?? constraintPattern);
			throw Errors.invalidRequest(`${label}のみで入力してください`);
		}
	}
}

function assertTextConstraints(
	formItems: {
		id: string;
		type: FormItemType;
		constraintMinLength: number | null;
		constraintMaxLength: number | null;
		constraintPattern: string | null;
		constraintCustomPattern: string | null;
	}[],
	answers: CreateFormResponseRequest["answers"]
) {
	const answerMap = new Map(answers.map(a => [a.formItemId, a]));

	for (const item of formItems) {
		if (item.type !== "TEXT" && item.type !== "TEXTAREA") continue;
		if (
			item.constraintMinLength === null &&
			item.constraintMaxLength === null &&
			item.constraintPattern === null
		)
			continue;

		const answer = answerMap.get(item.id);
		if (!answer) continue;
		if (answer.type !== "TEXT" && answer.type !== "TEXTAREA") continue;

		const value = answer.textValue;
		if (!value) continue;

		assertItemTextConstraints(item, value);
	}
}
// ─────────────────────────────────────────────────────────────
// ヘルパー: FormItemEditHistory にレコードを追加
// ─────────────────────────────────────────────────────────────

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function extractAnswerValues(answer: CreateFormResponseRequest["answers"][0]) {
	const isText = answer.type === "TEXT" || answer.type === "TEXTAREA";
	const isSelect = answer.type === "SELECT" || answer.type === "CHECKBOX";
	return {
		textValue: isText ? (answer.textValue ?? null) : null,
		numberValue: answer.type === "NUMBER" ? (answer.numberValue ?? null) : null,
		fileIds: answer.type === "FILE" ? normalizeFileIds(answer.fileIds) : [],
		optionIds: isSelect ? (answer.selectedOptionIds ?? []) : [],
	};
}

const appendEditHistory = async (
	tx: PrismaTx,
	answers: CreateFormResponseRequest["answers"],
	projectId: string,
	actorId: string,
	trigger: "PROJECT_SUBMIT" | "PROJECT_RESUBMIT"
) => {
	for (const answer of answers) {
		const { textValue, numberValue, fileIds, optionIds } =
			extractAnswerValues(answer);

		const history = await tx.formItemEditHistory.create({
			data: {
				formItemId: answer.formItemId,
				projectId,
				textValue,
				numberValue,
				actorId,
				trigger,
			},
		});
		if (fileIds.length > 0) {
			await tx.formItemEditHistoryFile.createMany({
				data: fileIds.map((fileId, sortOrder) => ({
					editHistoryId: history.id,
					fileId,
					sortOrder,
				})),
			});
		}
		if (optionIds.length > 0) {
			await tx.formItemEditHistorySelectedOption.createMany({
				data: optionIds.map(optionId => ({
					editHistoryId: history.id,
					formItemOptionId: optionId,
				})),
			});
		}
	}
};

// ─────────────────────────────────────────────────────────────
// ヘルパー: カテゴリ指定の遅延Delivery同期
// ─────────────────────────────────────────────────────────────
async function syncCategoryFormDeliveries(
	projectId: string,
	projectType: ProjectType,
	projectLocation: ProjectLocation
) {
	const now = new Date();

	// カテゴリモードで承認済み・配信時刻到来済みの Authorization を取得
	const categoryAuths = await prisma.formAuthorization.findMany({
		where: {
			deliveryMode: "CATEGORY",
			status: "APPROVED",
			scheduledSendAt: { lte: now },
			form: { deletedAt: null },
		},
		select: { id: true, filterTypes: true, filterLocations: true },
	});

	// フィルタ条件に合致する Authorization を絞り込み（AND条件）
	const matchingAuthIds = categoryAuths
		.filter(auth => {
			const typeOk =
				auth.filterTypes.length === 0 || auth.filterTypes.includes(projectType);
			const locationOk =
				auth.filterLocations.length === 0 ||
				auth.filterLocations.includes(projectLocation);
			return typeOk && locationOk;
		})
		.map(auth => auth.id);

	if (matchingAuthIds.length === 0) return;

	// この企画に対して既に Delivery が存在する Authorization を一括取得
	const existingDeliveries = await prisma.formDelivery.findMany({
		where: {
			projectId,
			formAuthorizationId: { in: matchingAuthIds },
		},
		select: { formAuthorizationId: true },
	});

	const existingAuthIds = new Set(
		existingDeliveries.map(d => d.formAuthorizationId)
	);

	// 未作成分だけ一括作成
	const newDeliveries = matchingAuthIds
		.filter(id => !existingAuthIds.has(id))
		.map(formAuthorizationId => ({ formAuthorizationId, projectId }));

	if (newDeliveries.length > 0) {
		await prisma.formDelivery.createMany({
			data: newDeliveries,
			skipDuplicates: true,
		});
	}
}

// ─────────────────────────────────────────────────────────────
// GET /project/:projectId/forms
// ─────────────────────────────────────────────────────────────

projectFormRoute.get("/", requireAuth, requireProjectMember, async c => {
	const project = c.get("project");
	const projectId = project.id;
	const projectRole = c.get("projectRole");

	// カテゴリ指定の遅延Delivery同期
	await syncCategoryFormDeliveries(projectId, project.type, project.location);

	const now = new Date();

	const deliveries = await prisma.formDelivery.findMany({
		where: {
			projectId,
			formAuthorization: {
				status: "APPROVED",
				scheduledSendAt: { lte: now },
				form: { deletedAt: null },
			},
		},
		include: {
			formAuthorization: {
				select: {
					scheduledSendAt: true,
					deadlineAt: true,
					allowLateResponse: true,
					required: true,
					ownerOnly: true,
					form: { select: { id: true, title: true, description: true } },
				},
			},
		},
		orderBy: { formAuthorization: { scheduledSendAt: "desc" } },
	});

	const isOwnerOrSubOwner =
		projectRole === "OWNER" || projectRole === "SUB_OWNER";

	const deliveryIds = deliveries.map(d => d.id);
	const responses = deliveryIds.length
		? await prisma.formResponse.findMany({
				where: { formDeliveryId: { in: deliveryIds } },
				select: {
					id: true,
					formDeliveryId: true,
					submittedAt: true,
				},
			})
		: [];

	const responseMap = new Map(responses.map(r => [r.formDeliveryId, r]));
	return c.json({
		forms: deliveries.map(d => {
			const isRestricted = d.formAuthorization.ownerOnly && !isOwnerOrSubOwner;
			const response = responseMap.get(d.id) ?? null;
			return {
				formDeliveryId: d.id,
				formId: d.formAuthorization.form.id,
				title: d.formAuthorization.form.title,
				description: isRestricted ? null : d.formAuthorization.form.description,
				scheduledSendAt: d.formAuthorization.scheduledSendAt,
				deadlineAt: d.formAuthorization.deadlineAt,
				allowLateResponse: d.formAuthorization.allowLateResponse,
				required: d.formAuthorization.required,
				ownerOnly: d.formAuthorization.ownerOnly,
				restricted: isRestricted,
				response: isRestricted
					? null
					: response
						? { id: response.id, submittedAt: response.submittedAt }
						: null,
			};
		}),
	});
});

// ─────────────────────────────────────────────────────────────
// GET /project/:projectId/forms/:formDeliveryId
// ─────────────────────────────────────────────────────────────

projectFormRoute.get(
	"/:formDeliveryId",
	requireAuth,
	requireProjectMember,
	async c => {
		const { projectId, formDeliveryId } = projectFormPathParamsSchema.parse({
			projectId: c.req.param("projectId"),
			formDeliveryId: c.req.param("formDeliveryId"),
		});
		const projectRole = c.get("projectRole");

		const delivery = await getDeliveryOrThrow(projectId, formDeliveryId);
		const { form } = delivery.formAuthorization;

		// ownerOnly 制限チェック
		if (delivery.formAuthorization.ownerOnly && projectRole === "MEMBER") {
			throw Errors.forbidden("この申請は責任者・副責任者のみ閲覧できます");
		}

		const existingResponse = await prisma.formResponse.findFirst({
			where: { formDeliveryId },
			include: {
				answers: {
					include: {
						selectedOptions: true,
						files: answerFilesInclude,
					},
				},
			},
		});

		// FormItemEditHistory の最新値を取得して表示値をオーバーレイ
		const formItemIds = form.items.map(item => item.id);
		const allHistory = await prisma.formItemEditHistory.findMany({
			where: { formItemId: { in: formItemIds }, projectId },
			orderBy: { createdAt: "desc" },
			include: {
				selectedOptions: true,
				files: answerFilesInclude,
			},
		});
		const latestByItem = new Map<string, (typeof allHistory)[number]>();
		for (const h of allHistory) {
			if (!latestByItem.has(h.formItemId)) latestByItem.set(h.formItemId, h);
		}

		return c.json({
			form: {
				formDeliveryId: delivery.id,
				formId: form.id,
				title: form.title,
				description: form.description,
				scheduledSendAt: delivery.formAuthorization.scheduledSendAt,
				deadlineAt: delivery.formAuthorization.deadlineAt,
				allowLateResponse: delivery.formAuthorization.allowLateResponse,
				required: delivery.formAuthorization.required,
				ownerOnly: false,
				items: form.items.map(item => ({
					id: item.id,
					label: item.label,
					type: item.type,
					description: item.description,
					required: item.required,
					sortOrder: item.sortOrder,
					options: item.options
						.sort((a, b) => a.sortOrder - b.sortOrder)
						.map(opt => ({
							id: opt.id,
							label: opt.label,
							sortOrder: opt.sortOrder,
						})),
					constraints: constraintsFromPrisma(item),
				})),
				response: existingResponse
					? {
							id: existingResponse.id,
							submittedAt: existingResponse.submittedAt,
							answers: existingResponse.answers.map(a => {
								const hist = latestByItem.get(a.formItemId);
								if (hist) {
									return {
										formItemId: a.formItemId,
										textValue: hist.textValue,
										numberValue: hist.numberValue,
										files: mapAnswerFiles(hist.files),
										selectedOptionIds: hist.selectedOptions.map(
											s => s.formItemOptionId
										),
									};
								}
								return {
									formItemId: a.formItemId,
									textValue: a.textValue,
									numberValue: a.numberValue,
									files: mapAnswerFiles(a.files),
									selectedOptionIds: a.selectedOptions.map(
										s => s.formItemOptionId
									),
								};
							}),
						}
					: null,
			},
		});
	}
);

// ─────────────────────────────────────────────────────────────
// POST /project/:projectId/forms/:formDeliveryId/response
// ─────────────────────────────────────────────────────────────

projectFormRoute.post(
	"/:formDeliveryId/response",
	requireAuth,
	requireProjectMember,
	async c => {
		const { projectId, formDeliveryId } = projectFormPathParamsSchema.parse({
			projectId: c.req.param("projectId"),
			formDeliveryId: c.req.param("formDeliveryId"),
		});
		const userId = c.get("user").id;
		const projectRole = c.get("projectRole");

		const delivery = await getDeliveryOrThrow(projectId, formDeliveryId);

		// ownerOnly 制限チェック
		if (delivery.formAuthorization.ownerOnly && projectRole === "MEMBER") {
			throw Errors.forbidden("この申請は責任者・副責任者のみ回答できます");
		}

		const body = await c.req.json().catch(() => ({}));
		const { answers, submit } = createFormResponseRequestSchema.parse(body);
		const validationItems =
			delivery.formAuthorization.form.items.map(mapItemToApiShape);

		assertFormAnswersValid(validationItems, answers);

		checkDeadline(delivery.formAuthorization);

		if (submit) {
			assertRequiredAnswered(validationItems, answers);
			assertFileCountConstraints(validationItems, answers);
			assertTextConstraints(delivery.formAuthorization.form.items, answers);
		}

		const response = await prisma.$transaction(async tx => {
			const existing = await tx.formResponse.findFirst({
				where: { formDeliveryId },
			});
			if (existing) {
				throw Errors.alreadyExists(
					"既に回答が存在します。更新する場合はPATCHを使用してください"
				);
			}

			const created = await tx.formResponse.create({
				data: {
					formDeliveryId,
					respondentId: userId,
					submittedAt: submit ? new Date() : null,
				},
			});

			await upsertAnswers(tx, created.id, answers);

			if (submit) {
				await appendEditHistory(
					tx,
					answers,
					projectId,
					userId,
					"PROJECT_SUBMIT"
				);
			}

			return formatResponse(tx, created.id);
		});

		return c.json({ response }, 201);
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /project/:projectId/forms/:formDeliveryId/response
// ─────────────────────────────────────────────────────────────

projectFormRoute.patch(
	"/:formDeliveryId/response",
	requireAuth,
	requireProjectMember,
	async c => {
		const { projectId, formDeliveryId } = projectFormPathParamsSchema.parse({
			projectId: c.req.param("projectId"),
			formDeliveryId: c.req.param("formDeliveryId"),
		});
		const userId = c.get("user").id;
		const projectRole = c.get("projectRole");

		const delivery = await getDeliveryOrThrow(projectId, formDeliveryId);

		// ownerOnly 制限チェック
		if (delivery.formAuthorization.ownerOnly && projectRole === "MEMBER") {
			throw Errors.forbidden("この申請は責任者・副責任者のみ回答できます");
		}

		const existing = await prisma.formResponse.findFirst({
			where: { formDeliveryId },
		});
		if (!existing) throw Errors.notFound("回答が見つかりません");

		const body = await c.req.json().catch(() => ({}));
		const { answers, submit } = updateFormResponseRequestSchema.parse(body);
		const validationItems =
			delivery.formAuthorization.form.items.map(mapItemToApiShape);

		assertFormAnswersValid(validationItems, answers);

		const isAlreadySubmitted = existing.submittedAt !== null;

		checkDeadline(delivery.formAuthorization);

		if (submit || isAlreadySubmitted) {
			assertRequiredAnswered(validationItems, answers);
			assertFileCountConstraints(validationItems, answers);
			assertTextConstraints(delivery.formAuthorization.form.items, answers);
		}

		const response = await prisma.$transaction(async tx => {
			await tx.formResponse.update({
				where: { id: existing.id },
				data: {
					submittedAt: isAlreadySubmitted || submit ? new Date() : null,
					respondentId: userId,
				},
			});

			await upsertAnswers(tx, existing.id, answers);

			if (submit || isAlreadySubmitted) {
				await appendEditHistory(
					tx,
					answers,
					projectId,
					userId,
					isAlreadySubmitted ? "PROJECT_RESUBMIT" : "PROJECT_SUBMIT"
				);
			}

			return formatResponse(tx, existing.id);
		});

		return c.json({ response });
	}
);

export { projectFormRoute };
