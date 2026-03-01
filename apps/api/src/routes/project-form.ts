import {
	type CreateFormResponseRequest,
	createFormResponseRequestSchema,
	type FormItemType,
	projectFormPathParamsSchema,
	updateFormResponseRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
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
	answers: CreateFormResponseRequest["answers"],
	formItems: { id: string; type: FormItemType }[]
) => {
	const itemTypeMap = new Map(formItems.map(i => [i.id, i.type]));
	// 既存回答を全削除して再作成（シンプルな全置き換え）
	await tx.formAnswer.deleteMany({ where: { formResponseId: responseId } });

	for (const answer of answers) {
		const type = itemTypeMap.get(answer.formItemId);
		if (!type) {
			throw Errors.invalidRequest("不正な設問IDです");
		}
		if (type !== answer.type) {
			throw Errors.invalidRequest("設問タイプと回答タイプが一致しません");
		}

		switch (answer.type) {
			case "TEXT":
			case "TEXTAREA":
				await tx.formAnswer.create({
					data: {
						formResponseId: responseId,
						formItemId: answer.formItemId,
						textValue: answer.textValue ?? null,
					},
				});
				break;

			case "NUMBER":
				await tx.formAnswer.create({
					data: {
						formResponseId: responseId,
						formItemId: answer.formItemId,
						numberValue: answer.numberValue ?? null,
					},
				});
				break;

			case "FILE":
				await tx.formAnswer.create({
					data: {
						formResponseId: responseId,
						formItemId: answer.formItemId,
						fileUrl: answer.fileUrl ?? null,
					},
				});
				break;

			case "SELECT":
			case "CHECKBOX":
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
				break;
		}
	}
};

// ─────────────────────────────────────────────────────────────
// ヘルパー: 回答で含まれないIdをはじく
// ─────────────────────────────────────────────────────────────
function assertSelectedOptionsValid(
	formItems: {
		id: string;
		type: FormItemType;
		options: { id: string }[];
	}[],
	answers: CreateFormResponseRequest["answers"]
) {
	const itemMap = new Map(
		formItems.map(item => [
			item.id,
			{
				type: item.type,
				optionIds: new Set(item.options.map(o => o.id)),
			},
		])
	);

	for (const answer of answers) {
		const meta = itemMap.get(answer.formItemId);
		if (!meta) {
			throw Errors.invalidRequest("不正な設問IDです");
		}

		// SELECT / CHECKBOX 以外は無視
		if (answer.type !== "SELECT" && answer.type !== "CHECKBOX") {
			continue;
		}

		const ids = answer.selectedOptionIds ?? [];

		for (const id of ids) {
			if (!meta.optionIds.has(id)) {
				throw Errors.invalidRequest(
					`不正な選択肢IDです（formItemId: ${answer.formItemId}）`
				);
			}
		}
	}
}

// ─────────────────────────────────────────────────────────────
// ヘルパー: レスポンス整形
// ─────────────────────────────────────────────────────────────

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

	return {
		id: response.id,
		submittedAt: response.submittedAt,
		answers: response.answers.map(a => ({
			formItemId: a.formItemId,
			textValue: a.textValue,
			numberValue: a.numberValue,
			fileUrl: a.fileUrl,
			selectedOptionIds: a.selectedOptions.map(s => s.formItemOptionId),
		})),
	};
};

function assertRequiredAnswered(
	formItems: {
		id: string;
		type: FormItemType;
		required: boolean;
	}[],
	answers: CreateFormResponseRequest["answers"]
) {
	const answerMap = new Map(answers.map(a => [a.formItemId, a]));

	for (const item of formItems) {
		if (!item.required) continue;

		const answer = answerMap.get(item.id);

		const isEmpty = (() => {
			if (!answer) return true;

			switch (answer.type) {
				case "TEXT":
				case "TEXTAREA":
					return !answer.textValue;

				case "NUMBER":
					return answer.numberValue == null;

				case "FILE":
					return !answer.fileUrl;

				case "SELECT":
				case "CHECKBOX":
					return (
						!answer.selectedOptionIds || answer.selectedOptionIds.length === 0
					);

				default:
					return true;
			}
		})();

		if (isEmpty) {
			throw Errors.invalidRequest(
				`必須項目が未入力です（formItemId: ${item.id}）`
			);
		}
	}
}
// ─────────────────────────────────────────────────────────────
// GET /project/:projectId/forms
// ─────────────────────────────────────────────────────────────

projectFormRoute.get("/", requireAuth, requireProjectMember, async c => {
	const projectId = c.req.param("projectId");

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
					form: { select: { id: true, title: true, description: true } },
				},
			},
		},
		orderBy: { formAuthorization: { scheduledSendAt: "desc" } },
	});

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
			const response = responseMap.get(d.id) ?? null;
			return {
				formDeliveryId: d.id,
				formId: d.formAuthorization.form.id,
				title: d.formAuthorization.form.title,
				description: d.formAuthorization.form.description,
				scheduledSendAt: d.formAuthorization.scheduledSendAt,
				deadlineAt: d.formAuthorization.deadlineAt,
				allowLateResponse: d.formAuthorization.allowLateResponse,
				required: d.formAuthorization.required,
				response: response
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

		const delivery = await getDeliveryOrThrow(projectId, formDeliveryId);
		const { form } = delivery.formAuthorization;

		const existingResponse = await prisma.formResponse.findFirst({
			where: { formDeliveryId },
			include: {
				answers: { include: { selectedOptions: true } },
			},
		});

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
				})),
				response: existingResponse
					? {
							id: existingResponse.id,
							submittedAt: existingResponse.submittedAt,
							answers: existingResponse.answers.map(a => ({
								formItemId: a.formItemId,
								textValue: a.textValue,
								numberValue: a.numberValue,
								fileUrl: a.fileUrl,
								selectedOptionIds: a.selectedOptions.map(
									s => s.formItemOptionId
								),
							})),
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

		const delivery = await getDeliveryOrThrow(projectId, formDeliveryId);

		const body = await c.req.json().catch(() => ({}));
		const { answers, submit } = createFormResponseRequestSchema.parse(body);

		assertSelectedOptionsValid(delivery.formAuthorization.form.items, answers);

		checkDeadline(delivery.formAuthorization);

		if (submit) {
			assertRequiredAnswered(delivery.formAuthorization.form.items, answers);
		}

		const existing = await prisma.formResponse.findFirst({
			where: { formDeliveryId },
		});
		if (existing) {
			throw Errors.alreadyExists(
				"既に回答が存在します。更新する場合はPATCHを使用してください"
			);
		}

		const response = await prisma.$transaction(async tx => {
			const created = await tx.formResponse.create({
				data: {
					formDeliveryId,
					respondentId: userId,
					submittedAt: submit ? new Date() : null,
				},
			});

			await upsertAnswers(
				tx,
				created.id,
				answers,
				delivery.formAuthorization.form.items
			);
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

		const delivery = await getDeliveryOrThrow(projectId, formDeliveryId);

		const existing = await prisma.formResponse.findFirst({
			where: { formDeliveryId },
		});
		if (!existing) throw Errors.notFound("回答が見つかりません");

		const body = await c.req.json().catch(() => ({}));
		const { answers, submit } = updateFormResponseRequestSchema.parse(body);

		assertSelectedOptionsValid(delivery.formAuthorization.form.items, answers);

		const isAlreadySubmitted = existing.submittedAt !== null;

		checkDeadline(delivery.formAuthorization);

		if (submit || isAlreadySubmitted) {
			assertRequiredAnswered(delivery.formAuthorization.form.items, answers);
		}

		const response = await prisma.$transaction(async tx => {
			await tx.formResponse.update({
				where: { id: existing.id },
				data: {
					submittedAt: isAlreadySubmitted || submit ? new Date() : null,
					respondentId: userId,
				},
			});

			await upsertAnswers(
				tx,
				existing.id,
				answers,
				delivery.formAuthorization.form.items
			);
			return formatResponse(tx, existing.id);
		});

		return c.json({ response });
	}
);

export { projectFormRoute };
