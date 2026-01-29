import { z } from "zod";
import { tsukubaEmailSchema } from "../lib/email";

/**
 * 名スキーマ
 */
export const firstNameSchema = z.string().min(1, "名を入力してください");
export type FirstName = z.infer<typeof firstNameSchema>;

/**
 * 姓スキーマ
 */
export const lastNameSchema = z.string().min(1, "姓を入力してください");
export type LastName = z.infer<typeof lastNameSchema>;

/**
 * ユーザーステータス
 * - ACTIVE: 有効
 * - DISABLED: 無効化
 */
export const userStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
export type UserStatus = z.infer<typeof userStatusSchema>;

/**
 * ユーザーロール
 * - PLANNER: 企画者
 * - COMMITTEE_MEMBER: 委員会メンバー
 * - COMMITTEE_ADMIN: 委員会管理者
 * - SYSTEM_ADMIN: システム管理者
 */
export const userRoleSchema = z.enum([
	"PLANNER",
	"COMMITTEE_MEMBER",
	"COMMITTEE_ADMIN",
	"SYSTEM_ADMIN",
]);
export type UserRole = z.infer<typeof userRoleSchema>;

/**
 * ユーザースキーマ
 * Firebase UIDと紐づくアプリケーションユーザー
 */
export const userSchema = z.object({
	id: z.cuid(),
	firebaseUid: z.string().min(1).max(128),
	email: tsukubaEmailSchema,
	firstName: firstNameSchema,
	lastName: lastNameSchema,
	role: userRoleSchema,
	status: userStatusSchema,
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;
