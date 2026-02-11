import {
	getMeResponseSchema,
	registerRequestSchema,
	registerResponseSchema,
	startEmailVerificationRequestSchema,
	startEmailVerificationResponseSchema,
	verifyEmailRequestSchema,
	verifyEmailResponseSchema,
} from "../schemas/auth";
import type { BodyEndpoint, GetEndpoint } from "./types";

/**
 * POST /auth/email/start
 * メール検証を開始する
 *
 * - 筑波大学メールアドレス形式を検証
 * - 検証トークンを生成してメール送信
 * - 既存ユーザーでも常に成功レスポンス（列挙耐性）
 */
export const startEmailVerificationEndpoint: BodyEndpoint<
	"POST",
	"/auth/email/start",
	undefined,
	undefined,
	typeof startEmailVerificationRequestSchema,
	typeof startEmailVerificationResponseSchema
> = {
	method: "POST",
	path: "/auth/email/start",
	pathParams: undefined,
	query: undefined,
	request: startEmailVerificationRequestSchema,
	response: startEmailVerificationResponseSchema,
} as const;

/**
 * POST /auth/email/verify
 * メール検証を確定する
 *
 * - token から tokenHash を計算
 * - EmailVerification を原子的に消費（DELETE ... RETURNING）
 * - reg_ticket Cookie を発行（15分有効）
 * - エラー: TOKEN_INVALID（不正または期限切れ）
 */
export const verifyEmailEndpoint: BodyEndpoint<
	"POST",
	"/auth/email/verify",
	undefined,
	undefined,
	typeof verifyEmailRequestSchema,
	typeof verifyEmailResponseSchema
> = {
	method: "POST",
	path: "/auth/email/verify",
	pathParams: undefined,
	query: undefined,
	request: verifyEmailRequestSchema,
	response: verifyEmailResponseSchema,
} as const;

/**
 * POST /auth/register
 * 本登録（Firebaseユーザー作成 + DBユーザー作成）
 *
 * - Cookie の reg_ticket を検証・消費
 * - Firebase Admin SDK で createUser
 * - DB に User レコードを作成
 * - 既存 User がある場合は冪等で成功
 * - エラー: TOKEN_INVALID, ALREADY_EXISTS, VALIDATION_ERROR
 */
export const registerEndpoint: BodyEndpoint<
	"POST",
	"/auth/register",
	undefined,
	undefined,
	typeof registerRequestSchema,
	typeof registerResponseSchema
> = {
	method: "POST",
	path: "/auth/register",
	pathParams: undefined,
	query: undefined,
	request: registerRequestSchema,
	response: registerResponseSchema,
} as const;

/**
 * GET /auth/me
 * 現在のログインユーザーを取得
 *
 * - Authorization: Bearer <Firebase ID Token> ヘッダーが必要
 * - Firebase ID Token を検証
 * - firebaseUid から User を取得（deletedAt が null のもの）
 * - committeeMember 情報も含めて返す（未登録なら null）
 * - エラー: UNAUTHORIZED, NOT_FOUND
 */
export const getMeEndpoint: GetEndpoint<
	"/auth/me",
	undefined,
	undefined,
	typeof getMeResponseSchema
> = {
	method: "GET",
	path: "/auth/me",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: getMeResponseSchema,
} as const;
