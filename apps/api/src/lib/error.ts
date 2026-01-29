import {
	type ApiErrorResponse,
	type ErrorCode,
	ErrorCodeToStatus,
} from "@sos26/shared";

/**
 * アプリケーションエラークラス
 *
 * ルートハンドラ内で throw することで、onError で捕捉され
 * 統一形式の ApiErrorResponse に変換される
 */
export class AppError extends Error {
	readonly code: ErrorCode;
	readonly details?: Record<string, unknown>;

	constructor(
		code: ErrorCode,
		message: string,
		details?: Record<string, unknown>
	) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.details = details;
	}

	/** HTTP ステータスコードを取得 */
	get status(): number {
		return ErrorCodeToStatus[this.code];
	}

	/** ApiErrorResponse 形式に変換 */
	toResponse(): ApiErrorResponse {
		return {
			error: {
				code: this.code,
				message: this.message,
				...(this.details && { details: this.details }),
			},
		};
	}
}

/**
 * 便利なエラー生成関数
 */
export const Errors = {
	notFound: (message = "リソースが見つかりません") =>
		new AppError("NOT_FOUND", message),

	unauthorized: (message = "認証が必要です") =>
		new AppError("UNAUTHORIZED", message),

	forbidden: (message = "アクセス権限がありません") =>
		new AppError("FORBIDDEN", message),

	alreadyExists: (message = "リソースは既に存在します") =>
		new AppError("ALREADY_EXISTS", message),

	validationError: (message: string, details?: Record<string, unknown>) =>
		new AppError("VALIDATION_ERROR", message, details),

	invalidRequest: (message = "リクエストが不正です") =>
		new AppError("INVALID_REQUEST", message),

	internal: (message = "内部エラーが発生しました") =>
		new AppError("INTERNAL", message),

	tokenInvalid: (message = "トークンが無効または期限切れです") =>
		new AppError("TOKEN_INVALID", message),
};
