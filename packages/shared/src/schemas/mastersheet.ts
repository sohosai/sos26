import { z } from "zod";
import { bureauSchema } from "./committee-member";
import { viewerScopeSchema } from "./common";
import { formItemTypeSchema } from "./form";
import { userSchema } from "./user";

// ─────────────────────────────────────────────────────────────
// Enum スキーマ
// ─────────────────────────────────────────────────────────────

export const mastersheetColumnTypeSchema = z.enum(["FORM_ITEM", "CUSTOM"]);
export type MastersheetColumnType = z.infer<typeof mastersheetColumnTypeSchema>;

export const mastersheetDataTypeSchema = z.enum([
	"TEXT",
	"NUMBER",
	"SELECT",
	"MULTI_SELECT",
]);
export type MastersheetDataType = z.infer<typeof mastersheetDataTypeSchema>;

export const mastersheetColumnVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);
export type MastersheetColumnVisibility = z.infer<
	typeof mastersheetColumnVisibilitySchema
>;

/** フォーム由来カラムのセル状態 */
export const mastersheetCellStatusSchema = z.enum([
	"NOT_DELIVERED", // 未配信
	"NOT_ANSWERED", // 未回答
	"SUBMITTED", // 提出済み
	"COMMITTEE_EDITED", // 実委編集済み
]);
export type MastersheetCellStatus = z.infer<typeof mastersheetCellStatusSchema>;

/** 編集履歴のトリガー */
export const formItemEditHistoryTriggerSchema = z.enum([
	"PROJECT_SUBMIT",
	"PROJECT_RESUBMIT",
	"COMMITTEE_EDIT",
]);
export type FormItemEditHistoryTrigger = z.infer<
	typeof formItemEditHistoryTriggerSchema
>;

// ─────────────────────────────────────────────────────────────
// パスパラメータ
// ─────────────────────────────────────────────────────────────

export const mastersheetColumnIdPathParamsSchema = z.object({
	columnId: z.cuid(),
});

export const mastersheetColumnProjectPathParamsSchema = z.object({
	columnId: z.cuid(),
	projectId: z.cuid(),
});

export const mastersheetAccessRequestIdPathParamsSchema = z.object({
	requestId: z.cuid(),
});

export const mastersheetViewIdPathParamsSchema = z.object({
	viewId: z.cuid(),
});

// ─────────────────────────────────────────────────────────────
// アクセス権設定
// ─────────────────────────────────────────────────────────────

export const mastersheetViewerInputSchema = z
	.object({
		scope: viewerScopeSchema,
		bureauValue: bureauSchema.optional(),
		userId: z.cuid().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.scope === "BUREAU" && !data.bureauValue) {
			ctx.addIssue({
				code: "custom",
				message: "局を指定してください",
				path: ["bureauValue"],
			});
		}
		if (data.scope === "INDIVIDUAL" && !data.userId) {
			ctx.addIssue({
				code: "custom",
				message: "ユーザーを指定してください",
				path: ["userId"],
			});
		}
	});
export type MastersheetViewerInput = z.infer<
	typeof mastersheetViewerInputSchema
>;

// ─────────────────────────────────────────────────────────────
// 内部ヘルパー（export しない）
// ─────────────────────────────────────────────────────────────

const userSummarySchema = userSchema.pick({ id: true, name: true });

const columnOptionSchema = z.object({
	id: z.string(),
	label: z.string(),
	sortOrder: z.number().int(),
});

const columnViewerSchema = z.object({
	id: z.string(),
	scope: viewerScopeSchema,
	bureauValue: bureauSchema.nullable(),
	userId: z.string().nullable(),
	userName: z.string().nullable(),
});

/** セル値の共通フィールド（フォーム由来・自由追加・オーバーライド共通） */
const cellValueDataSchema = z.object({
	textValue: z.string().nullable(),
	numberValue: z.number().nullable(),
	fileUrl: z.string().nullable(),
	selectedOptionIds: z.array(z.string()),
});

/** カラム定義（GET /data レスポンスで返す列メタデータ） */
const mastersheetColumnDefSchema = z.object({
	id: z.string(),
	type: mastersheetColumnTypeSchema,
	name: z.string(),
	description: z.string().nullable(),
	sortOrder: z.number().int(),
	createdById: z.string(),
	createdByName: z.string(),
	isOwner: z.boolean(),
	// FORM_ITEM の場合
	formItemId: z.string().nullable(),
	formItemType: formItemTypeSchema.nullable(),
	// CUSTOM の場合
	dataType: mastersheetDataTypeSchema.nullable(),
	visibility: mastersheetColumnVisibilitySchema.nullable(),
	viewers: z.array(columnViewerSchema),
	options: z.array(columnOptionSchema),
	createdAt: z.coerce.date(),
});

/** セル（1企画 × 1カラム分のデータ） */
const mastersheetCellSchema = z.object({
	columnId: z.string(),
	// FORM_ITEM カラム用
	status: mastersheetCellStatusSchema.optional(),
	formValue: cellValueDataSchema.nullable().optional(),
	// CUSTOM カラム用
	cellValue: cellValueDataSchema.nullable().optional(),
});

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/data
// ─────────────────────────────────────────────────────────────

export const getMastersheetDataResponseSchema = z.object({
	columns: z.array(mastersheetColumnDefSchema),
	rows: z.array(
		z.object({
			project: z.object({
				id: z.string(),
				number: z.number().int(),
				name: z.string(),
				type: z.string(),
				organizationName: z.string(),
				owner: userSummarySchema,
				subOwner: userSummarySchema.nullable(),
			}),
			cells: z.array(mastersheetCellSchema),
		})
	),
});
export type GetMastersheetDataResponse = z.infer<
	typeof getMastersheetDataResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// POST /committee/mastersheet/columns
// ─────────────────────────────────────────────────────────────

const columnOptionInputSchema = z.object({
	label: z.string().min(1),
	sortOrder: z.number().int(),
});

/** カスタムカラム作成時の初期値（全企画に一括適用） */
const initialValueInputSchema = z.object({
	textValue: z.string().nullable().optional(),
	numberValue: z.number().nullable().optional(),
	/** options 配列のインデックス（作成前で ID が未確定のため） */
	selectedOptionIndexes: z.array(z.number().int().min(0)).optional(),
});
export type InitialValueInput = z.infer<typeof initialValueInputSchema>;

export const createMastersheetColumnRequestSchema = z.discriminatedUnion(
	"type",
	[
		z.object({
			type: z.literal("FORM_ITEM"),
			name: z.string().min(1),
			description: z.string().optional(),
			sortOrder: z.number().int(),
			formItemId: z.cuid(),
		}),
		z.object({
			type: z.literal("CUSTOM"),
			name: z.string().min(1),
			description: z.string().optional(),
			sortOrder: z.number().int(),
			dataType: mastersheetDataTypeSchema,
			viewers: z.array(mastersheetViewerInputSchema),
			options: z.array(columnOptionInputSchema).optional(),
			initialValue: initialValueInputSchema.optional(),
		}),
	]
);
export type CreateMastersheetColumnRequest = z.infer<
	typeof createMastersheetColumnRequestSchema
>;

export const createMastersheetColumnResponseSchema = z.object({
	column: mastersheetColumnDefSchema,
});
export type CreateMastersheetColumnResponse = z.infer<
	typeof createMastersheetColumnResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee/mastersheet/columns/:columnId
// ─────────────────────────────────────────────────────────────

export const updateMastersheetColumnRequestSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	sortOrder: z.number().int().optional(),
	viewers: z.array(mastersheetViewerInputSchema).optional(),
	options: z.array(columnOptionInputSchema).optional(),
});
export type UpdateMastersheetColumnRequest = z.infer<
	typeof updateMastersheetColumnRequestSchema
>;

export const updateMastersheetColumnResponseSchema = z.object({
	column: mastersheetColumnDefSchema,
});
export type UpdateMastersheetColumnResponse = z.infer<
	typeof updateMastersheetColumnResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// DELETE /committee/mastersheet/columns/:columnId
// ─────────────────────────────────────────────────────────────

export const deleteMastersheetColumnResponseSchema = z.object({
	success: z.literal(true),
});
export type DeleteMastersheetColumnResponse = z.infer<
	typeof deleteMastersheetColumnResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PUT /committee/mastersheet/cells/:columnId/:projectId
// ─────────────────────────────────────────────────────────────

export const upsertMastersheetCellRequestSchema = z.object({
	textValue: z.string().nullable().optional(),
	numberValue: z.number().nullable().optional(),
	selectedOptionIds: z.array(z.string()).optional(),
});
export type UpsertMastersheetCellRequest = z.infer<
	typeof upsertMastersheetCellRequestSchema
>;

export const upsertMastersheetCellResponseSchema = z.object({
	cell: mastersheetCellSchema,
});
export type UpsertMastersheetCellResponse = z.infer<
	typeof upsertMastersheetCellResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PUT /committee/mastersheet/edits/:columnId/:projectId
// ─────────────────────────────────────────────────────────────

export const editFormItemCellRequestSchema = z.object({
	textValue: z.string().nullable().optional(),
	numberValue: z.number().nullable().optional(),
	fileUrl: z.string().nullable().optional(),
	selectedOptionIds: z.array(z.string()).optional(),
});
export type EditFormItemCellRequest = z.infer<
	typeof editFormItemCellRequestSchema
>;

export const editFormItemCellResponseSchema = z.object({
	cell: mastersheetCellSchema,
});
export type EditFormItemCellResponse = z.infer<
	typeof editFormItemCellResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/columns/:columnId/history/:projectId
// ─────────────────────────────────────────────────────────────

export const formItemEditHistorySchema = z.object({
	id: z.string(),
	value: z.object({
		textValue: z.string().nullable(),
		numberValue: z.number().nullable(),
		fileUrl: z.string().nullable(),
		selectedOptionIds: z.array(z.string()),
	}),
	actor: userSummarySchema,
	trigger: formItemEditHistoryTriggerSchema,
	createdAt: z.coerce.date(),
});

export const getMastersheetHistoryResponseSchema = z.object({
	history: z.array(formItemEditHistorySchema),
});
export type GetMastersheetHistoryResponse = z.infer<
	typeof getMastersheetHistoryResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/columns/discover
// ─────────────────────────────────────────────────────────────

export const discoverMastersheetColumnsResponseSchema = z.object({
	columns: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			type: mastersheetColumnTypeSchema,
			createdById: z.string(),
			createdByName: z.string(),
			hasAccess: z.boolean(),
			pendingRequest: z.boolean(),
			// 権限ありの場合のみ含まれる
			description: z.string().nullable().optional(),
			dataType: mastersheetDataTypeSchema.nullable().optional(),
			visibility: mastersheetColumnVisibilitySchema.nullable().optional(),
		})
	),
});
export type DiscoverMastersheetColumnsResponse = z.infer<
	typeof discoverMastersheetColumnsResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// POST /committee/mastersheet/columns/:columnId/access-request
// ─────────────────────────────────────────────────────────────

export const createMastersheetAccessRequestResponseSchema = z.object({
	success: z.literal(true),
});
export type CreateMastersheetAccessRequestResponse = z.infer<
	typeof createMastersheetAccessRequestResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee/mastersheet/access-requests/:requestId
// ─────────────────────────────────────────────────────────────

export const updateMastersheetAccessRequestRequestSchema = z.object({
	status: z.enum(["APPROVED", "REJECTED"]),
});
export type UpdateMastersheetAccessRequestRequest = z.infer<
	typeof updateMastersheetAccessRequestRequestSchema
>;

export const updateMastersheetAccessRequestResponseSchema = z.object({
	success: z.literal(true),
});
export type UpdateMastersheetAccessRequestResponse = z.infer<
	typeof updateMastersheetAccessRequestResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/access-requests
// ─────────────────────────────────────────────────────────────

export const listMastersheetAccessRequestsResponseSchema = z.object({
	requests: z.array(
		z.object({
			id: z.string(),
			columnId: z.string(),
			requester: z.object({ id: z.string(), name: z.string() }),
			createdAt: z.coerce.date(),
		})
	),
});
export type ListMastersheetAccessRequestsResponse = z.infer<
	typeof listMastersheetAccessRequestsResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/views
// ─────────────────────────────────────────────────────────────

const mastersheetViewSchema = z.object({
	id: z.string(),
	name: z.string(),
	state: z.string(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export const listMastersheetViewsResponseSchema = z.object({
	views: z.array(mastersheetViewSchema),
});
export type ListMastersheetViewsResponse = z.infer<
	typeof listMastersheetViewsResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// POST /committee/mastersheet/views
// ─────────────────────────────────────────────────────────────

export const createMastersheetViewRequestSchema = z.object({
	name: z.string().min(1),
	state: z.string(),
});
export type CreateMastersheetViewRequest = z.infer<
	typeof createMastersheetViewRequestSchema
>;

export const createMastersheetViewResponseSchema = z.object({
	view: mastersheetViewSchema,
});
export type CreateMastersheetViewResponse = z.infer<
	typeof createMastersheetViewResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee/mastersheet/views/:viewId
// ─────────────────────────────────────────────────────────────

export const updateMastersheetViewRequestSchema = z.object({
	name: z.string().min(1).optional(),
	state: z.string().optional(),
});
export type UpdateMastersheetViewRequest = z.infer<
	typeof updateMastersheetViewRequestSchema
>;

export const updateMastersheetViewResponseSchema = z.object({
	view: mastersheetViewSchema,
});
export type UpdateMastersheetViewResponse = z.infer<
	typeof updateMastersheetViewResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// DELETE /committee/mastersheet/views/:viewId
// ─────────────────────────────────────────────────────────────

export const deleteMastersheetViewResponseSchema = z.object({
	success: z.literal(true),
});
export type DeleteMastersheetViewResponse = z.infer<
	typeof deleteMastersheetViewResponseSchema
>;
