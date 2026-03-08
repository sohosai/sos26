import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// 汎用 Enum（複数機能で共用）
// ─────────────────────────────────────────────────────────────

/** お問い合わせ・マスターシートで共用する閲覧者スコープ */
export const viewerScopeSchema = z.enum(["ALL", "BUREAU", "INDIVIDUAL"]);
export type ViewerScope = z.infer<typeof viewerScopeSchema>;

/** フォーム承認・マスターシートアクセス申請で共用する承認ステータス */
export const approvalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
