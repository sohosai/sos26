import { z } from "zod";
import { projectLocationSchema, projectTypeSchema } from "./project";

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

/** カテゴリ指定: 企画区分・実施場所で配信先をフィルタ（OR結合、合計1つ以上） */
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

export const deliveryTargetSchema = z
	.discriminatedUnion("mode", [categoryTargetSchema, individualTargetSchema])
	.superRefine((data, ctx) => {
		if (
			data.mode === "CATEGORY" &&
			data.projectTypes.length + data.projectLocations.length < 1
		) {
			ctx.addIssue({
				code: "custom",
				message: "企画区分または実施場所を1つ以上指定してください",
				path: ["projectTypes"],
			});
		}
	});
export type DeliveryTarget = z.infer<typeof deliveryTargetSchema>;
