/**
 * APIエラーコード定義
 *
 * フロントエンド・バックエンド間で共有されるエラーコード
 * UI分岐は必ずこの code で行う（message 文字列での分岐は禁止）
 */
export const ERROR_CODES = [
	"UNAUTHORIZED", // 401 - 認証エラー
	"FORBIDDEN", // 403 - 権限エラー
	"NOT_FOUND", // 404 - リソース不在
	"ALREADY_EXISTS", // 409 - 重複エラー
	"VALIDATION_ERROR", // 400 - バリデーションエラー
	"INVALID_REQUEST", // 400 - 不正リクエスト
	"TOKEN_INVALID", // 400 - 検証トークン / reg_ticket が不正または期限切れ
	"INTERNAL", // 500 - 内部エラー
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** ErrorCode.UNAUTHORIZED のようにアクセスできるオブジェクト */
export const ErrorCode = Object.fromEntries(
	ERROR_CODES.map(code => [code, code])
) as { [K in ErrorCode]: K };

/**
 * ErrorCode から HTTP ステータスコードへのマッピング
 */
export const ErrorCodeToStatus: Record<ErrorCode, number> = {
	[ErrorCode.UNAUTHORIZED]: 401,
	[ErrorCode.FORBIDDEN]: 403,
	[ErrorCode.NOT_FOUND]: 404,
	[ErrorCode.ALREADY_EXISTS]: 409,
	[ErrorCode.VALIDATION_ERROR]: 400,
	[ErrorCode.INVALID_REQUEST]: 400,
	[ErrorCode.TOKEN_INVALID]: 400,
	[ErrorCode.INTERNAL]: 500,
};
