import {
	type CreateFormResponseRequest,
	createFormResponseRequestSchema,
	type FormItemType,
	projectFormPathParamsSchema,
	projectFormResponsePathParamsSchema,
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
	const delivery = await prisma.formDelivery.findFirst({
		where: {
			id: formDeliveryId,
			projectId,
			formAuthorization: { status: "APPROVED" },
		},
		include: {
			formAuthorization: {
				include: {
					form: {
						include: {
							items: {
								include: { options: true },
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

const checkDeadline = (
	auth: { deadlineAt: Date | null; allowLateResponse: boolean },
	isSubmit: boolean
) => {
	if (!isSubmit) return; // 下書き保存は期限チェックしない
	if (!auth.deadlineAt) return; // 期限なし
	if (auth.allowLateResponse) return; // 遅延提出許可あり
	if (auth.deadlineAt < new Date()) {
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
		// const { selectedOptionIds, ...answerData } = answer;
		// await tx.formAnswer.create({
		// 	data: {
		// 		formResponseId: responseId,
		// 		formItemId: answer.formItemId,
		// 		textValue: answerData.textValue ?? null,
		// 		numberValue: answerData.numberValue ?? null,
		// 		fileUrl: answerData.fileUrl ?? null,
		// 		selectedOptions: selectedOptionIds?.length
		// 			? {
		// 					create: selectedOptionIds.map(formItemOptionId => ({
		// 						formItemOptionId,
		// 					})),
		// 				}
		// 			: undefined,
		// },
		// });
		const type = itemTypeMap.get(answer.formItemId);
		if (!type) {
			throw Errors.invalidRequest("不正な設問IDです");
		}

		switch (type) {
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
// ─────────────────────────────────────────────────────────────
// GET /project/:projectId/forms
// ─────────────────────────────────────────────────────────────

projectFormRoute.get("/", requireAuth, requireProjectMember, async c => {
	const projectId = c.req.param("projectId");
	const userId = c.get("user").id;

	const now = new Date();

	const deliveries = await prisma.formDelivery.findMany({
		where: {
			projectId,
			formAuthorization: {
				status: "APPROVED",
				scheduledSendAt: {
					lte: now,
				},
			},
		},
		include: {
			formAuthorization: {
				include: {
					form: { select: { id: true, title: true, description: true } },
				},
			},
			responses: {
				where: { respondentId: userId },
				select: { id: true, submittedAt: true },
				take: 1,
			},
		},
		orderBy: { formAuthorization: { scheduledSendAt: "desc" } },
	});

	return c.json({
		forms: deliveries.map(d => ({
			formDeliveryId: d.id,
			formId: d.formAuthorization.form.id,
			title: d.formAuthorization.form.title,
			description: d.formAuthorization.form.description,
			scheduledSendAt: d.formAuthorization.scheduledSendAt,
			deadlineAt: d.formAuthorization.deadlineAt,
			allowLateResponse: d.formAuthorization.allowLateResponse,
			required: d.formAuthorization.required,
			response: d.responses[0] ?? null,
		})),
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
		const userId = c.get("user").id;

		const delivery = await getDeliveryOrThrow(projectId, formDeliveryId);
		const { form } = delivery.formAuthorization;

		const existingResponse = await prisma.formResponse.findFirst({
			where: { formDeliveryId, respondentId: userId },
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
// POST /project/:projectId/forms/:formDeliveryId/responses
// ─────────────────────────────────────────────────────────────

projectFormRoute.post(
	"/:formDeliveryId/responses",
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

		checkDeadline(delivery.formAuthorization, submit);

		const existing = await prisma.formResponse.findFirst({
			where: { formDeliveryId, respondentId: userId },
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
// PATCH /project/:projectId/forms/:formDeliveryId/responses/:responseId
// ─────────────────────────────────────────────────────────────

projectFormRoute.patch(
	"/:formDeliveryId/responses/:responseId",
	requireAuth,
	requireProjectMember,
	async c => {
		const { projectId, formDeliveryId, responseId } =
			projectFormResponsePathParamsSchema.parse({
				projectId: c.req.param("projectId"),
				formDeliveryId: c.req.param("formDeliveryId"),
				responseId: c.req.param("responseId"),
			});
		const userId = c.get("user").id;

		const delivery = await getDeliveryOrThrow(projectId, formDeliveryId);

		const existing = await prisma.formResponse.findFirst({
			where: { id: responseId, formDeliveryId, respondentId: userId },
		});
		if (!existing) throw Errors.notFound("回答が見つかりません");

		const body = await c.req.json().catch(() => ({}));
		const { answers, submit } = updateFormResponseRequestSchema.parse(body);

		checkDeadline(delivery.formAuthorization, submit);

		const response = await prisma.$transaction(async tx => {
			await tx.formResponse.update({
				where: { id: responseId },
				data: { submittedAt: submit ? new Date() : null },
			});

			await upsertAnswers(
				tx,
				responseId,
				answers,
				delivery.formAuthorization.form.items
			);
			return formatResponse(tx, responseId);
		});

		return c.json({ response });
	}
);

export { projectFormRoute };
