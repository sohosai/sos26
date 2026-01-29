import {
	type ApiErrorResponse,
	apiErrorResponseSchema,
	type ErrorCode,
} from "@sos26/shared";
import { HTTPError, TimeoutError } from "ky";
import { ZodError } from "zod";

/**
 * フロント用統一エラー型
 *
 * API Clientがすべての失敗をこの型に変換してthrowする
 * UI層では try-catch せず、TanStack Query の error として扱う
 *
 * 分岐は kind で行い、APIエラーの場合は code getter で分岐する
 */
export type ClientError =
	| { kind: "api"; error: ApiErrorResponse }
	| { kind: "network"; message: string }
	| { kind: "timeout"; message: string }
	| { kind: "abort"; message: string }
	| { kind: "unknown"; message: string; cause?: unknown };

/**
 * ClientErrorを継承したErrorクラス
 *
 * TanStack Queryがerrorを捕捉するためにはErrorインスタンスである必要がある
 */
export class ClientErrorClass extends Error {
	readonly clientError: ClientError;

	constructor(clientError: ClientError) {
		const message =
			clientError.kind === "api"
				? clientError.error.error.message
				: clientError.message;
		super(message);
		this.name = "ClientError";
		this.clientError = clientError;
	}

	/** ClientError 型にアクセスするためのgetter */
	get kind(): ClientError["kind"] {
		return this.clientError.kind;
	}

	/** APIエラーの場合はエラーコード、それ以外はundefined */
	get code(): ErrorCode | undefined {
		return this.clientError.kind === "api"
			? this.clientError.error.error.code
			: undefined;
	}

	/** APIエラーの場合はApiErrorResponse、それ以外はundefined */
	get apiError(): ApiErrorResponse | undefined {
		return this.clientError.kind === "api" ? this.clientError.error : undefined;
	}
}

/**
 * ClientErrorかどうかを判定する型ガード
 */
export function isClientError(error: unknown): error is ClientErrorClass {
	return error instanceof ClientErrorClass;
}

/** HTTPエラーから ClientError を生成 */
async function parseHttpError(error: HTTPError): Promise<ClientError> {
	const response = error.response.clone();
	const contentType = response.headers.get("content-type");

	if (contentType?.includes("application/json")) {
		const body = await response.json().catch(() => null);
		const parsed = apiErrorResponseSchema.safeParse(body);
		if (parsed.success) {
			return { kind: "api", error: parsed.data };
		}
	}

	return {
		kind: "unknown",
		message: `HTTP ${error.response.status}: ${error.response.statusText}`,
		cause: error,
	};
}

/** エラーを ClientError に変換 */
function toClientError(error: unknown): ClientError {
	// フロント側のZod実行時検証エラーはユーザー入力の問題
	// 生のissues配列などを露出しないよう、フレンドリーな文言に正規化
	if (error instanceof ZodError) {
		return { kind: "unknown", message: "入力値が不正です" };
	}
	if (error instanceof TimeoutError) {
		return { kind: "timeout", message: "リクエストがタイムアウトしました" };
	}
	if (error instanceof DOMException && error.name === "AbortError") {
		return { kind: "abort", message: "リクエストが中断されました" };
	}
	if (error instanceof TypeError) {
		return { kind: "network", message: "ネットワークエラーが発生しました" };
	}
	return {
		kind: "unknown",
		message:
			error instanceof Error ? error.message : "不明なエラーが発生しました",
		cause: error,
	};
}

/**
 * 各種エラーを ClientError に変換してthrowする
 *
 * API Clientの try-catch 内でのみ使用する
 */
export async function throwClientError(error: unknown): Promise<never> {
	const clientError =
		error instanceof HTTPError
			? await parseHttpError(error)
			: toClientError(error);

	throw new ClientErrorClass(clientError);
}
