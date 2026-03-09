import { z } from "zod";
import { tsukubaEmailSchema } from "../lib/email";
import { toHiragana } from "../lib/phonetic";

/**
 * 名前スキーマ
 */
export const nameSchema = z.string().min(1, "名前を入力してください");
export type Name = z.infer<typeof nameSchema>;

/**
 * 名前（ふりがな）スキーマ
 *
 * - カタカナが入力された場合はひらがなに自動変換する
 */
export const namePhoneticSchema = z
	.string()
	.min(1, "名前（ふりがな）を入力してください")
	.transform(toHiragana);
export type NamePhonetic = z.output<typeof namePhoneticSchema>;

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
 * 送信キー設定
 * ENTER: Enterで送信、Shift+Enterで改行
 * CTRL_ENTER: Ctrl+Enterで送信、Enterで改行
 */
export const sendKeySchema = z.enum(["ENTER", "CTRL_ENTER"]);
export type SendKey = z.infer<typeof sendKeySchema>;

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
	avatarFileId: z.string().nullable(),
	sendKey: sendKeySchema,
	deletedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

/**
 * ユーザー設定更新リクエスト
 */
export const updateUserSettingsRequestSchema = z.object({
	avatarFileId: z.string().nullable().optional(),
	sendKey: sendKeySchema.optional(),
});
export type UpdateUserSettingsRequest = z.infer<
	typeof updateUserSettingsRequestSchema
>;

/**
 * ユーザー設定更新レスポンス
 */
export const updateUserSettingsResponseSchema = z.object({
	user: userSchema,
});
export type UpdateUserSettingsResponse = z.infer<
	typeof updateUserSettingsResponseSchema
>;

/**
 * ユーザー設定取得レスポンス
 */
export const getUserSettingsResponseSchema = z.object({
	avatarFileId: z.string().nullable(),
	sendKey: sendKeySchema,
});
export type GetUserSettingsResponse = z.infer<
	typeof getUserSettingsResponseSchema
>;

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
