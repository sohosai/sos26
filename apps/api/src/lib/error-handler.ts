import * as Sentry from "@sentry/bun";
import type { ApiErrorResponse } from "@sos26/shared";
import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { AppError } from "./error";
import { logUnexpectedApiError } from "./error-logging";

/**
 * Hono の onError ハンドラ
 *
 * すべての例外を捕捉し、統一形式の ApiErrorResponse に変換して返却
 * - AppError: そのまま変換
 * - ZodError: バリデーションエラーとして変換
 * - その他: INTERNAL エラーとして変換（詳細は隠蔽）
 */
export const errorHandler: ErrorHandler = (err, c) => {
	// AppError: 明示的にthrowされたビジネスエラー
	if (err instanceof AppError) {
		// @hono/otel は c.error が設定されたままだと span を
		// 自動で ERROR 化してしまうため、正常系として扱うここでクリアする。
		c.error = undefined;
		return c.json(err.toResponse(), err.status as ContentfulStatusCode);
	}

	// ZodError: リクエストバリデーションエラー
	if (err instanceof ZodError) {
		// 同上（想定内エラーのため span を ERROR 化しない）。
		c.error = undefined;
		const response: ApiErrorResponse = {
			error: {
				code: "VALIDATION_ERROR",
				message: "入力値が不正です",
				details: {
					issues: err.issues.map(issue => ({
						path: issue.path.join("."),
						message: issue.message,
					})),
				},
			},
		};
		return c.json(response, 400);
	}

	// その他の予期しないエラー: 詳細を隠蔽してINTERNALとして返却
	// span への recordException / ERROR 化は @hono/otel が
	// c.error とレスポンスステータス(500) を見て自動で行うため、ここでは行わない
	// （二重記録を避けるため）。
	Sentry.captureException(err);
	logUnexpectedApiError("Internal Error", err, {
		method: c.req.method,
		path: c.req.path,
	});
	const response: ApiErrorResponse = {
		error: {
			code: "INTERNAL",
			message: "内部エラーが発生しました",
		},
	};
	return c.json(response, 500);
};
