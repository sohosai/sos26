import {
	createProjectRequestSchema,
	type FormAnswerValidationItem,
	getActiveProjectRegistrationFormsQuerySchema,
	joinProjectRequestSchema,
	type ProjectMemberRole,
	type RegistrationFormAnswersInput,
	updateProjectDetailRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import {
	assertFormAnswersValid,
	assertRequiredAnswered,
} from "../lib/form-answer-validation";
import { mapItemToApiShape } from "../lib/form-constraints";
import {
	notifySubOwnerRequestApproved,
	notifySubOwnerRequestCancelled,
	notifySubOwnerRequestRejected,
	notifySubOwnerRequestSent,
} from "../lib/notifications";
import { handlePrismaError, prisma } from "../lib/prisma";
import { requireAuth, requireProjectMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const projectRoute = new Hono<AuthEnv>();

// 招待コード生成
const generateInviteCode = () =>
	Math.random().toString(36).substring(2, 8).toUpperCase();

// 企画登録フォーム回答をPrisma用データに変換
const buildPrismaAnswerData = (
	answer: RegistrationFormAnswersInput["answers"][number]
) => ({
	formItemId: answer.formItemId,
	textValue: "textValue" in answer ? answer.textValue : undefined,
	numberValue: "numberValue" in answer ? answer.numberValue : undefined,
	fileId: "fileId" in answer ? answer.fileId : undefined,
	selectedOptions:
		"selectedOptionIds" in answer && answer.selectedOptionIds?.length
			? {
					create: answer.selectedOptionIds.map(formItemOptionId => ({
						formItemOptionId,
					})),
				}
			: undefined,
});

// 企画登録フォームの過不足・内容チェック
function validateRegistrationFormAnswers(
	applicableForms: {
		id: string;
		filterLocations: string[];
		items: FormAnswerValidationItem[];
	}[],
	location: string,
	registrationFormAnswers: RegistrationFormAnswersInput[] | null | undefined
) {
	const locationFilteredForms = applicableForms.filter(
		f => f.filterLocations.length === 0 || f.filterLocations.includes(location)
	);
	const applicableFormIds = new Set(locationFilteredForms.map(f => f.id));
	const submittedFormIds = new Set(
		(registrationFormAnswers ?? []).map(a => a.formId)
	);

	const missingFormIds = [...applicableFormIds].filter(
		id => !submittedFormIds.has(id)
	);
	if (missingFormIds.length > 0) {
		throw Errors.invalidRequest("必要な申請への回答が不足しています");
	}

	const extraFormIds = [...submittedFormIds].filter(
		id => !applicableFormIds.has(id)
	);
	if (extraFormIds.length > 0) {
		throw Errors.invalidRequest("対象外の申請への回答が含まれています");
	}

	if (registrationFormAnswers?.length) {
		const formItemsMap = new Map(
			locationFilteredForms.map(f => [f.id, f.items])
		);
		for (const { formId, answers } of registrationFormAnswers) {
			const items = formItemsMap.get(formId);
			if (!items) continue;
			assertFormAnswersValid(items, answers);
			assertRequiredAnswered(items, answers);
		}
	}
}

// 企画を作成
// ─────────────────────────────────────────
projectRoute.post("/create", requireAuth, async c => {
	const body = await c.req.json().catch(() => ({}));
	const {
		registrationFormAnswers,
		agreedToRegistrationConstraints: _agreedToRegistrationConstraints,
		agreedToInfoImmutability: _agreedToInfoImmutability,
		...data
	} = createProjectRequestSchema.parse(body);
	const userId = c.get("user").id;

	// ── 他の企画で責任者・副責任者をやっていないか確認 ──
	const hasOtherPrivilegedProject = await prisma.project.findFirst({
		where: {
			deletedAt: null,
			OR: [{ ownerId: userId }, { subOwnerId: userId }],
		},
	});

	if (hasOtherPrivilegedProject) {
		throw Errors.invalidRequest(
			"このユーザーは既に他の企画で責任者または副責任者です"
		);
	}

	// 招待コード生成（衝突回避）
	let inviteCode = generateInviteCode();
	while (await prisma.project.findUnique({ where: { inviteCode } })) {
		inviteCode = generateInviteCode();
	}
	const project = await prisma.$transaction(async tx => {
		// ── 対象申請の過不足チェック（トランザクション内で取得しTOCTOU防止）──
		const applicableForms = await tx.projectRegistrationForm.findMany({
			where: {
				isActive: true,
				deletedAt: null,
				OR: [
					{ filterTypes: { isEmpty: true } },
					{ filterTypes: { has: data.type } },
				],
			},
			select: {
				id: true,
				filterLocations: true,
				items: {
					select: {
						id: true,
						type: true,
						required: true,
						options: { select: { id: true } },
					},
					orderBy: { sortOrder: "asc" },
				},
			},
		});
		validateRegistrationFormAnswers(
			applicableForms,
			data.location,
			registrationFormAnswers
		);

		const created = await tx.project.create({
			data: {
				...data,
				ownerId: userId,
				subOwnerId: null,
				inviteCode,
				projectMembers: {
					create: {
						userId: userId,
					},
				},
			},
		});

		// 企画登録フォームの回答を保存
		if (registrationFormAnswers?.length) {
			for (const { formId, answers } of registrationFormAnswers) {
				await tx.projectRegistrationFormResponse.create({
					data: {
						formId,
						projectId: created.id,
						answers: {
							create: answers.map(buildPrismaAnswerData),
						},
					},
				});
			}
		}

		return created;
	});

	return c.json({ project });
});

// ─────────────────────────────────────────
// GET /project/list
// 自分が参加している企画一覧
// ─────────────────────────────────────────
projectRoute.get("/list", requireAuth, async c => {
	const userId = c.get("user").id;

	const projects = await prisma.project.findMany({
		where: {
			deletedAt: null,
			projectMembers: {
				some: {
					userId,
					deletedAt: null,
				},
			},
		},
	});

	return c.json({ projects });
});

// ─────────────────────────────────────────
// POST /project/join
// 招待コードで企画に参加
// ─────────────────────────────────────────
projectRoute.post("/join", requireAuth, async c => {
	const body = await c.req.json().catch(() => ({}));
	const { inviteCode } = joinProjectRequestSchema.parse(body);

	const userId = c.get("user").id;

	const project = await prisma.project.findFirst({
		where: {
			inviteCode,
			deletedAt: null,
		},
	});

	if (!project) {
		throw Errors.notFound("招待コードが無効です");
	}

	// 既にメンバーか確認
	const alreadyMember = await prisma.projectMember.findFirst({
		where: {
			projectId: project.id,
			userId,
			deletedAt: null,
		},
	});

	if (alreadyMember) {
		throw Errors.alreadyExists("既にこの企画に参加しています");
	}

	await prisma.projectMember.create({
		data: {
			projectId: project.id,
			userId,
		},
	});

	return c.json({ project });
});

// ─────────────────────────────────────────
// GET /project/:projectId/detail
// 企画の詳細を取得（招待コード含む）
// ─────────────────────────────────────────
projectRoute.get(
	"/:projectId/detail",
	requireAuth,
	requireProjectMember,
	async c => {
		const project = c.get("project");
		return c.json({ project });
	}
);

// ─────────────────────────────────────────
// GET /project/:projectId/registration-form-responses
// 企画登録フォーム回答一覧を取得
// ─────────────────────────────────────────
projectRoute.get(
	"/:projectId/registration-form-responses",
	requireAuth,
	requireProjectMember,
	async c => {
		const project = c.get("project");
		const responses = await prisma.projectRegistrationFormResponse.findMany({
			where: { projectId: project.id },
			include: {
				form: {
					select: {
						id: true,
						title: true,
						description: true,
					},
				},
				answers: {
					include: {
						formItem: {
							select: {
								id: true,
								label: true,
								type: true,
							},
						},
						selectedOptions: {
							include: {
								formItemOption: { select: { id: true, label: true } },
							},
						},
					},
					orderBy: {
						formItem: {
							sortOrder: "asc",
						},
					},
				},
			},
			orderBy: {
				submittedAt: "asc",
			},
		});

		return c.json({
			responses: responses.map(response => ({
				id: response.id,
				submittedAt: response.submittedAt,
				form: {
					id: response.form.id,
					title: response.form.title,
					description: response.form.description,
				},
				answers: response.answers.map(answer => ({
					formItemId: answer.formItem.id,
					formItemLabel: answer.formItem.label,
					type: answer.formItem.type,
					textValue: answer.textValue,
					numberValue: answer.numberValue,
					fileId: answer.fileId,
					selectedOptions: answer.selectedOptions.map(selected => ({
						id: selected.formItemOption.id,
						label: selected.formItemOption.label,
					})),
				})),
			})),
		});
	}
);

// ─────────────────────────────────────────
// PATCH /project/:projectId/detail
// 企画の設定変更（名前・団体名等）
// ─────────────────────────────────────────
projectRoute.patch(
	"/:projectId/detail",
	requireAuth,
	requireProjectMember,
	async c => {
		const role = c.get("projectRole");
		if (role !== "OWNER") {
			throw Errors.forbidden("企画の設定を変更できるのは責任者のみです");
		}

		const body = await c.req.json().catch(() => ({}));
		const data = updateProjectDetailRequestSchema.parse(body);
		const project = c.get("project");

		// type/location 整合性チェック
		const mergedType = data.type ?? project.type;
		const mergedLocation = data.location ?? project.location;
		if (mergedType === "STAGE" && mergedLocation !== "STAGE") {
			throw Errors.invalidRequest(
				"ステージ企画の実施場所はステージのみ指定できます"
			);
		}
		if (mergedType !== "STAGE" && mergedLocation === "STAGE") {
			throw Errors.invalidRequest(
				"ステージ以外の企画の実施場所にステージは指定できません"
			);
		}

		const updated = await prisma.project.update({
			where: { id: project.id },
			data,
		});

		return c.json({ project: updated });
	}
);

// ─────────────────────────────────────────
// POST /project/:projectId/invite-code/regenerate
// 招待コードを再生成
// ─────────────────────────────────────────
projectRoute.post(
	"/:projectId/invite-code/regenerate",
	requireAuth,
	requireProjectMember,
	async c => {
		const role = c.get("projectRole");
		if (role !== "OWNER") {
			throw Errors.forbidden("招待コードを再生成できるのは責任者のみです");
		}

		const project = c.get("project");

		let inviteCode = generateInviteCode();
		while (await prisma.project.findUnique({ where: { inviteCode } })) {
			inviteCode = generateInviteCode();
		}

		await prisma.project.update({
			where: { id: project.id },
			data: { inviteCode },
		});

		return c.json({ inviteCode });
	}
);

// ─────────────────────────────────────────
// GET /project/:projectId/members
// 該当する企画のメンバー一覧
// ─────────────────────────────────────────
projectRoute.get(
	"/:projectId/members",
	requireAuth,
	requireProjectMember,
	async c => {
		const project = c.get("project");

		const members = await prisma.projectMember.findMany({
			where: {
				projectId: project.id,
				deletedAt: null,
			},
			include: {
				user: true,
			},
			orderBy: {
				joinedAt: "asc",
			},
		});

		// PENDINGの副責任者リクエストを取得
		const pendingRequest = await prisma.projectSubOwnerRequest.findFirst({
			where: {
				projectId: project.id,
				status: "PENDING",
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		const result = members.map(m => {
			let role: ProjectMemberRole = "MEMBER";

			if (m.userId === project.ownerId) {
				role = "OWNER";
			} else if (m.userId === project.subOwnerId) {
				role = "SUB_OWNER";
			}

			return {
				id: m.id,
				userId: m.userId,
				name: m.user.name,
				email: m.user.email,
				role,
				joinedAt: m.joinedAt,
			};
		});

		return c.json({
			members: result,
			pendingSubOwnerRequestUserId: pendingRequest?.userId ?? null,
		});
	}
);

// ─────────────────────────────────────────
// POST /project/:projectId/members/:userId/remove
// メンバーを削除
// ─────────────────────────────────────────
projectRoute.post(
	"/:projectId/members/:userId/remove",
	requireAuth,
	requireProjectMember,
	async c => {
		const { userId } = c.req.param();
		const role = c.get("projectRole");
		const project = c.get("project");

		if (role === "MEMBER") {
			throw Errors.forbidden("この操作を行う権限がありません");
		}

		// 削除対象がメンバーか確認
		const member = await prisma.projectMember.findFirst({
			where: {
				projectId: project.id,
				userId,
				deletedAt: null,
			},
		});

		if (!member) {
			throw Errors.notFound("対象ユーザーは企画メンバーではありません");
		}

		if (userId === project.ownerId || userId === project.subOwnerId) {
			throw Errors.invalidRequest("責任者・副責任者は削除できません");
		}

		// 削除対象が副責任者リクエストの対象ユーザーであればリクエストも拒否する
		await prisma.$transaction(async tx => {
			await tx.projectSubOwnerRequest.updateMany({
				where: {
					projectId: project.id,
					userId,
					status: "PENDING",
				},
				data: {
					status: "REJECTED",
					decidedAt: new Date(),
					pendingProjectId: null,
				},
			});

			await tx.projectMember.update({
				where: { id: member.id },
				data: { deletedAt: new Date() },
			});
		});

		return c.json({ success: true });
	}
);

// ─────────────────────────────────────────
// POST /project/:projectId/members/:userId/assign
// メンバーに副責任者リクエストを送信
// ─────────────────────────────────────────
projectRoute.post(
	"/:projectId/members/:userId/assign",
	requireAuth,
	requireProjectMember,
	async c => {
		const { userId } = c.req.param();
		const role = c.get("projectRole");
		const project = c.get("project");

		if (role !== "OWNER") {
			throw Errors.forbidden("副責任者を任命できるのは責任者のみです");
		}

		// 任命対象がメンバーか
		const member = await prisma.projectMember.findFirst({
			where: {
				projectId: project.id,
				userId,
				deletedAt: null,
			},
		});
		if (!member) {
			throw Errors.notFound("対象ユーザーは企画メンバーではありません");
		}

		// 既に副責任者がいる場合はエラー
		if (project.subOwnerId) {
			throw Errors.invalidRequest("既に副責任者が任命されています");
		}

		// 責任者は指定不可
		if (userId === project.ownerId) {
			throw Errors.invalidRequest("責任者を副責任者には指定できません");
		}

		// 他企画で責任者、副責任者をやっていないかチェック
		const hasOtherPrivilegedProject = await prisma.project.findFirst({
			where: {
				deletedAt: null,
				id: {
					not: project.id,
				},
				OR: [{ ownerId: userId }, { subOwnerId: userId }],
			},
		});

		if (hasOtherPrivilegedProject) {
			throw Errors.invalidRequest(
				"このユーザーは既に他の企画で責任者または副責任者です"
			);
		}

		// 既存のPENDINGのリクエストがないか確認
		const existingRequest = await prisma.projectSubOwnerRequest.findFirst({
			where: {
				projectId: project.id,
				status: "PENDING",
			},
		});

		if (existingRequest) {
			throw Errors.invalidRequest("既に副責任者リクエストが送信されています");
		}

		const [request, owner] = await Promise.all([
			prisma.projectSubOwnerRequest
				.create({
					data: {
						projectId: project.id,
						userId,
						status: "PENDING",
						pendingProjectId: project.id,
					},
				})
				.catch(handlePrismaError),
			prisma.user.findUniqueOrThrow({
				where: { id: project.ownerId },
				select: { name: true },
			}),
		]);

		await notifySubOwnerRequestSent({
			targetUserId: userId,
			ownerName: owner.name,
			projectName: project.name,
		});

		return c.json({
			success: true,
			requestId: request.id,
			status: request.status,
		});
	}
);

/**
 * POST /project/:projectId/sub-owner-request/approve
 * 指名されたユーザーが副責任者リクエストを承認する
 */
projectRoute.post(
	"/:projectId/sub-owner-request/approve",
	requireAuth,
	requireProjectMember,
	async c => {
		const userId = c.get("user").id;
		const project = c.get("project");

		// リクエスト対象ユーザー本人かを先に確認
		const pendingRequest = await prisma.projectSubOwnerRequest.findFirst({
			where: {
				projectId: project.id,
				userId,
				status: "PENDING",
			},
		});

		if (!pendingRequest) {
			throw Errors.notFound("自分宛ての副責任者リクエストが見つかりません");
		}

		await prisma.$transaction(async tx => {
			const currentProject = await tx.project.findFirst({
				where: {
					id: project.id,
					deletedAt: null,
				},
				select: {
					id: true,
					ownerId: true,
					subOwnerId: true,
				},
			});

			if (!currentProject) {
				throw Errors.notFound("企画が見つかりません");
			}

			if (
				currentProject.ownerId === userId ||
				currentProject.subOwnerId === userId
			) {
				throw Errors.forbidden(
					"副責任者リクエストを承認できるのはメンバーのみです"
				);
			}

			// 既に副責任者がいる場合はエラー
			if (currentProject.subOwnerId) {
				throw Errors.invalidRequest("既に副責任者が任命されています");
			}
			// 他企画で責任者、副責任者をやっていないかチェック
			const hasOtherPrivilegedProject = await tx.project.findFirst({
				where: {
					deletedAt: null,
					id: {
						not: project.id,
					},
					OR: [{ ownerId: userId }, { subOwnerId: userId }],
				},
				select: {
					id: true,
				},
			});

			if (hasOtherPrivilegedProject) {
				throw Errors.invalidRequest(
					"既に他の企画で責任者または副責任者のユーザーは副責任者になることはできません"
				);
			}

			const approveResult = await tx.projectSubOwnerRequest.updateMany({
				where: {
					projectId: project.id,
					userId,
					status: "PENDING",
				},
				data: {
					status: "APPROVED",
					decidedAt: new Date(),
					pendingProjectId: null,
				},
			});

			if (approveResult.count !== 1) {
				throw Errors.notFound("副責任者リクエストの承認対象が見つかりません");
			}

			const updateProjectResult = await tx.project.updateMany({
				where: {
					id: project.id,
					subOwnerId: null,
				},
				data: {
					subOwnerId: userId,
				},
			});

			if (updateProjectResult.count !== 1) {
				throw Errors.invalidRequest("既に副責任者が任命されています");
			}
		});

		const approvedUser = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
			select: { name: true },
		});

		await notifySubOwnerRequestApproved({
			ownerUserId: project.ownerId,
			approvedUserName: approvedUser.name,
			projectName: project.name,
		});

		return c.json({
			success: true,
		});
	}
);

/**
 * POST /project/:projectId/sub-owner-request/cancel
 * 責任者が副責任者リクエストを取り消す
 */
projectRoute.post(
	"/:projectId/sub-owner-request/cancel",
	requireAuth,
	requireProjectMember,
	async c => {
		const role = c.get("projectRole");
		const project = c.get("project");

		if (role !== "OWNER") {
			throw Errors.forbidden(
				"副責任者リクエストを取り消せるのは責任者のみです"
			);
		}

		// 取り消し前にリクエスト対象ユーザーを取得（メール送信用）
		const pendingRequest = await prisma.projectSubOwnerRequest.findFirst({
			where: {
				projectId: project.id,
				status: "PENDING",
			},
			select: { userId: true },
		});

		if (!pendingRequest) {
			throw Errors.notFound("取り消し対象の副責任者リクエストが見つかりません");
		}

		await prisma.projectSubOwnerRequest.updateMany({
			where: {
				projectId: project.id,
				status: "PENDING",
			},
			data: {
				status: "REJECTED",
				decidedAt: new Date(),
				pendingProjectId: null,
			},
		});

		const owner = await prisma.user.findUniqueOrThrow({
			where: { id: project.ownerId },
			select: { name: true },
		});

		await notifySubOwnerRequestCancelled({
			targetUserId: pendingRequest.userId,
			ownerName: owner.name,
			projectName: project.name,
		});

		return c.json({
			success: true,
		});
	}
);

/**
 * POST /project/:projectId/sub-owner-request/reject
 * 指名されたユーザーが副責任者リクエストを辞退する
 */
projectRoute.post(
	"/:projectId/sub-owner-request/reject",
	requireAuth,
	requireProjectMember,
	async c => {
		const userId = c.get("user").id;
		const project = c.get("project");

		// リクエスト対象ユーザー本人かを先に確認
		const pendingRequest = await prisma.projectSubOwnerRequest.findFirst({
			where: {
				projectId: project.id,
				userId,
				status: "PENDING",
			},
		});

		if (!pendingRequest) {
			throw Errors.notFound("自分宛ての副責任者リクエストが見つかりません");
		}

		const rejectResult = await prisma.projectSubOwnerRequest.updateMany({
			where: {
				projectId: project.id,
				userId,
				status: "PENDING",
			},
			data: {
				status: "REJECTED",
				decidedAt: new Date(),
				pendingProjectId: null,
			},
		});

		if (rejectResult.count < 1) {
			throw Errors.notFound("副責任者リクエストの辞退対象が見つかりません");
		}

		const rejectedUser = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
			select: { name: true },
		});

		await notifySubOwnerRequestRejected({
			ownerUserId: project.ownerId,
			rejectedUserName: rejectedUser.name,
			projectName: project.name,
		});

		return c.json({
			success: true,
		});
	}
);

// ─────────────────────────────────────────────────────────────
// GET /project/registration-forms
// 有効な企画登録フォーム一覧を取得（type / location でフィルタ）
// 企画登録のページ2以降に使用
// ─────────────────────────────────────────────────────────────
projectRoute.get("/registration-forms", requireAuth, async c => {
	const query = getActiveProjectRegistrationFormsQuerySchema.parse(
		c.req.query()
	);

	const forms = await prisma.projectRegistrationForm.findMany({
		where: {
			isActive: true,
			deletedAt: null,
			// filterTypes が空なら全区分対象、そうでなければ指定区分に含まれるもの
			OR: [
				{ filterTypes: { isEmpty: true } },
				{ filterTypes: { has: query.type } },
			],
		},
		include: {
			items: {
				include: { options: { orderBy: { sortOrder: "asc" } } },
				orderBy: { sortOrder: "asc" },
			},
		},
		orderBy: { sortOrder: "asc" },
	});

	// filterLocations もフィルタ（空なら全場所対象）
	const filtered = forms.filter(
		f =>
			f.filterLocations.length === 0 ||
			f.filterLocations.includes(query.location)
	);

	return c.json({
		forms: filtered.map(
			({
				ownerId,
				deletedAt,
				isActive,
				sortOrder,
				filterTypes,
				filterLocations,
				...rest
			}) => ({
				...rest,
				items: rest.items.map(mapItemToApiShape),
			})
		),
	});
});

export { projectRoute };
