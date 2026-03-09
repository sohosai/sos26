import { z } from "zod";
import { tsukubaEmailSchema } from "../lib/email";

/**
 * 名前スキーマ
 */
export const nameSchema = z.string().min(1, "名前を入力してください");
export type Name = z.infer<typeof nameSchema>;

/**
 * 名前（フリガナ）スキーマ
 */
export const namePhoneticSchema = z
	.string()
	.min(1, "名前（フリガナ）を入力してください");
export type NamePhonetic = z.infer<typeof namePhoneticSchema>;

/**
 * 電話番号スキーマ
 */
export const telephoneNumberSchema = z
	.string()
	.min(10, "電話番号を正しく入力してください")
	.max(15, "電話番号を正しく入力してください")
	.regex(
		/^\+?\d{1,4}?[-.\s]?\d{1,4}[-.\s]?\d{4,10}$/,
		"電話番号の形式が不正です"
	);
export type TelephoneNumber = z.infer<typeof telephoneNumberSchema>;

/**
 * ユーザースキーマ
 * Firebase UIDと紐づくアプリケーションユーザー
 */
export const userSchema = z.object({
	id: z.cuid(),
	firebaseUid: z.string().min(1).max(128),
	email: tsukubaEmailSchema,
	name: nameSchema,
	namePhonetic: namePhoneticSchema,
	telephoneNumber: telephoneNumberSchema,
	deletedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

/**
 * ユーザー検索クエリパラメータ
 *
 * - search: 名前・メールアドレス・読み仮名で曖昧検索
 * - limit: 最大取得件数（デフォルト: 10）
 */
export const searchUsersQuerySchema = z.object({
	search: z.string().min(1),
	limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;
export type SearchUsersQueryInput = z.input<typeof searchUsersQuerySchema>;

/**
 * ユーザー検索結果のサマリー
 * 検索結果として返すユーザー情報（機密情報は除外）
 */
export const userSummarySchema = userSchema.pick({
	id: true,
	email: true,
	name: true,
	namePhonetic: true,
});
export type UserSummary = z.infer<typeof userSummarySchema>;

/**
 * ユーザー検索レスポンス
 */
export const searchUsersResponseSchema = z.object({
	users: userSummarySchema.array(),
});
export type SearchUsersResponse = z.infer<typeof searchUsersResponseSchema>;
