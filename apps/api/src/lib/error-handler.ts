import * as Sentry from "@sentry/bun";
import type { ApiErrorResponse } from "@sos26/shared";
import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { AppError } from "./error";

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
		return c.json(err.toResponse(), err.status as ContentfulStatusCode);
	}

	// ZodError: リクエストバリデーションエラー
	if (err instanceof ZodError) {
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
	Sentry.captureException(err);
	console.error("[Internal Error]", err);
	const response: ApiErrorResponse = {
		error: {
			code: "INTERNAL",
			message: "内部エラーが発生しました",
		},
	};
	return c.json(response, 500);
};
