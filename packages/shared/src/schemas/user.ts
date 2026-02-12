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
