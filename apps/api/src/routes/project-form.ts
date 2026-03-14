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
	assertFormAnswersValid,
	assertRequiredAnswered,
} from "../lib/form-answer-validation";
import { constraintsFromPrisma } from "../lib/form-constraints";
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

const upsertAnswers = async (
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
	responseId: string,
	answers: CreateFormResponseRequest["answers"]
) => {
	// 既存回答を全削除して再作成（シンプルな全置き換え）
	await tx.formAnswer.deleteMany({ where: { formResponseId: responseId } });

	// SELECT/CHECKBOX 以外はバッチ作成
	const simpleAnswers = answers.filter(
		a => a.type !== "SELECT" && a.type !== "CHECKBOX"
	);
	if (simpleAnswers.length > 0) {
		await tx.formAnswer.createMany({
			data: simpleAnswers.map(answer => ({
				formResponseId: responseId,
				formItemId: answer.formItemId,
				textValue:
					answer.type === "TEXT" || answer.type === "TEXTAREA"
						? (answer.textValue ?? null)
						: null,
				numberValue:
					answer.type === "NUMBER" ? (answer.numberValue ?? null) : null,
				fileId: answer.type === "FILE" ? (answer.fileId ?? null) : null,
			})),
		});
	}

	// SELECT/CHECKBOX はネストされたリレーションがあるため個別作成
	const selectAnswers = answers.filter(
		a => a.type === "SELECT" || a.type === "CHECKBOX"
	);
	for (const answer of selectAnswers) {
		await tx.formAnswer.create({
			data: {
				formResponseId: responseId,
				formItemId: answer.formItemId,
				selectedOptions: {
					create: (answer.selectedOptionIds ?? []).map(id => ({
						formItemOptionId: id,
					})),
				},
			},
		});
	}
};

// ─────────────────────────────────────────────────────────────
// ヘルパー: レスポンス整形
// ─────────────────────────────────────────────────────────────

type ProjectFormFileMetadata = {
	id: string;
	fileName: string;
	mimeType: string;
	isPublic: boolean;
};

function toProjectFormFileMetadata(
	file: ProjectFormFileMetadata | null | undefined
): ProjectFormFileMetadata | null {
	return file
		? {
				id: file.id,
				fileName: file.fileName,
				mimeType: file.mimeType,
				isPublic: file.isPublic,
			}
		: null;
}

async function getProjectFormFileMetadataMap(
	db: typeof prisma | PrismaTx,
	fileIds: Array<string | null | undefined>
) {
	const uniqueIds = [...new Set(fileIds.filter((id): id is string => !!id))];
	if (uniqueIds.length === 0) {
		return new Map<string, ProjectFormFileMetadata>();
	}

	const files = await db.file.findMany({
		where: {
			id: { in: uniqueIds },
			status: "CONFIRMED",
			deletedAt: null,
		},
		select: {
			id: true,
			fileName: true,
			mimeType: true,
			isPublic: true,
		},
	});

	return new Map(files.map(file => [file.id, file]));
}

const formatResponse = async (
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
	responseId: string
) => {
	const response = await tx.formResponse.findUniqueOrThrow({
		where: { id: responseId },
		include: {
			answers: {
				include: { selectedOptions: true },
			},
		},
	});
	const fileMap = await getProjectFormFileMetadataMap(
		tx,
		response.answers.map(answer => answer.fileId)
	);

	return {
		id: response.id,
		submittedAt: response.submittedAt,
		answers: response.answers.map(a => ({
			formItemId: a.formItemId,
			textValue: a.textValue,
			numberValue: a.numberValue,
			fileId: a.fileId,
			fileMetadata: toProjectFormFileMetadata(
				a.fileId ? fileMap.get(a.fileId) : null
			),
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
		fileId: answer.type === "FILE" ? (answer.fileId ?? null) : null,
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
	// オプション無しの回答はバッチ作成
	const withoutOptions = answers.filter(a => {
		const { optionIds } = extractAnswerValues(a);
		return optionIds.length === 0;
	});
	const withOptions = answers.filter(a => {
		const { optionIds } = extractAnswerValues(a);
		return optionIds.length > 0;
	});

	if (withoutOptions.length > 0) {
		await tx.formItemEditHistory.createMany({
			data: withoutOptions.map(answer => {
				const { textValue, numberValue, fileId } = extractAnswerValues(answer);
				return {
					formItemId: answer.formItemId,
					projectId,
					textValue,
					numberValue,
					fileId,
					actorId,
					trigger,
				};
			}),
		});
	}

	// オプション有りの回答は個別作成（IDが必要なため）
	for (const answer of withOptions) {
		const { textValue, numberValue, fileId, optionIds } =
			extractAnswerValues(answer);

		const history = await tx.formItemEditHistory.create({
			data: {
				formItemId: answer.formItemId,
				projectId,
				textValue,
				numberValue,
				fileId,
				actorId,
				trigger,
			},
		});
		await tx.formItemEditHistorySelectedOption.createMany({
			data: optionIds.map(optionId => ({
				editHistoryId: history.id,
				formItemOptionId: optionId,
			})),
		});
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

	for (const auth of categoryAuths) {
		// 両方空 = 全企画対象
		const isAllTarget =
			auth.filterTypes.length === 0 && auth.filterLocations.length === 0;
		// OR条件: filterTypes のいずれかに一致 OR filterLocations のいずれかに一致
		const matchesType =
			auth.filterTypes.length > 0 && auth.filterTypes.includes(projectType);
		const matchesLocation =
			auth.filterLocations.length > 0 &&
			auth.filterLocations.includes(projectLocation);

		if (!isAllTarget && !matchesType && !matchesLocation) continue;

		// まだ Delivery がなければ作成
		await prisma.formDelivery.upsert({
			where: {
				formAuthorizationId_projectId: {
					formAuthorizationId: auth.id,
					projectId,
				},
			},
			create: {
				formAuthorizationId: auth.id,
				projectId,
			},
			update: {},
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
				answers: { include: { selectedOptions: true } },
			},
		});

		// FormItemEditHistory の最新値を取得して表示値をオーバーレイ
		const formItemIds = form.items.map(item => item.id);
		const allHistory = await prisma.formItemEditHistory.findMany({
			where: { formItemId: { in: formItemIds }, projectId },
			orderBy: { createdAt: "desc" },
			include: { selectedOptions: true },
		});
		const latestByItem = new Map<string, (typeof allHistory)[number]>();
		for (const h of allHistory) {
			if (!latestByItem.has(h.formItemId)) latestByItem.set(h.formItemId, h);
		}
		const fileMap = await getProjectFormFileMetadataMap(prisma, [
			...(existingResponse?.answers.map(answer => answer.fileId) ?? []),
			...allHistory.map(history => history.fileId),
		]);

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
										fileId: hist.fileId,
										fileMetadata: toProjectFormFileMetadata(
											hist.fileId ? fileMap.get(hist.fileId) : null
										),
										selectedOptionIds: hist.selectedOptions.map(
											s => s.formItemOptionId
										),
									};
								}
								return {
									formItemId: a.formItemId,
									textValue: a.textValue,
									numberValue: a.numberValue,
									fileId: a.fileId,
									fileMetadata: toProjectFormFileMetadata(
										a.fileId ? fileMap.get(a.fileId) : null
									),
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

		assertFormAnswersValid(delivery.formAuthorization.form.items, answers);

		checkDeadline(delivery.formAuthorization);

		if (submit) {
			assertRequiredAnswered(delivery.formAuthorization.form.items, answers);
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

		assertFormAnswersValid(delivery.formAuthorization.form.items, answers);

		const isAlreadySubmitted = existing.submittedAt !== null;

		checkDeadline(delivery.formAuthorization);

		if (submit || isAlreadySubmitted) {
			assertRequiredAnswered(delivery.formAuthorization.form.items, answers);
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
