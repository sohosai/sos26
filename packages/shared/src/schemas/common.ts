import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// 企画区分・実施場所（循環参照回避のためここで定義）
// ─────────────────────────────────────────────────────────────

export const projectTypeSchema = z.enum(["STAGE", "FOOD", "NORMAL"]);
export type ProjectType = z.infer<typeof projectTypeSchema>;

export const projectLocationSchema = z.enum(["INDOOR", "OUTDOOR", "STAGE"]);
export type ProjectLocation = z.infer<typeof projectLocationSchema>;

// ─────────────────────────────────────────────────────────────
// 汎用 Enum（複数機能で共用）
// ─────────────────────────────────────────────────────────────

/** お問い合わせ・マスターシートで共用する閲覧者スコープ */
export const viewerScopeSchema = z.enum(["ALL", "BUREAU", "INDIVIDUAL"]);
export type ViewerScope = z.infer<typeof viewerScopeSchema>;

/** フォーム承認・マスターシートアクセス申請で共用する承認ステータス */
export const approvalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

// ─────────────────────────────────────────────────────────────
// 配信先指定モード（お知らせ・フォームで共用）
// ─────────────────────────────────────────────────────────────

export const deliveryModeSchema = z.enum(["INDIVIDUAL", "CATEGORY"]);
export type DeliveryMode = z.infer<typeof deliveryModeSchema>;

/** カテゴリ指定: 企画区分・実施場所で配信先をフィルタ（AND結合、両方空=全企画対象） */
const categoryTargetSchema = z.object({
	mode: z.literal("CATEGORY"),
	projectTypes: z.array(projectTypeSchema),
	projectLocations: z.array(projectLocationSchema),
});

/** 個別指定: 企画IDを直接指定 */
const individualTargetSchema = z.object({
	mode: z.literal("INDIVIDUAL"),
	projectIds: z.array(z.string().min(1)).min(1, "配信先企画を指定してください"),
});

export const deliveryTargetSchema = z.discriminatedUnion("mode", [
	categoryTargetSchema,
	individualTargetSchema,
]);
export type DeliveryTarget = z.infer<typeof deliveryTargetSchema>;
