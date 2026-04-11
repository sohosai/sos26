import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { isClientError } from "../http/error";

const IMPORTANT_ERROR_OPERATIONS = [
	"create",
	"save",
	"draft_save",
	"submit",
	"publish_request",
	"approve",
	"reject",
	"delete",
	"join_project",
	"collaborator_update",
	"inquiry_create",
	"comment_submit",
	"assignee_update",
	"update_base_info",
	"api_response_validation",
] as const;

type ImportantErrorOperation = (typeof IMPORTANT_ERROR_OPERATIONS)[number];

export type ErrorOperation = ImportantErrorOperation | "read";

const importantOperationSet: Set<string> = new Set(IMPORTANT_ERROR_OPERATIONS);

type ErrorUi =
	| { type: "none" }
	| { type: "toast" }
	| { type: "inline"; setError: (message: string) => void };

type ResolveMessageInput = {
	error: unknown;
	fallbackMessage: string;
};

type ReportHandledErrorOptions = {
	error: unknown;
	operation: ErrorOperation;
	userMessage: string;
	context?: Record<string, unknown>;
	ui?: ErrorUi;
	preferErrorMessage?: boolean;
	resolveMessage?: (input: ResolveMessageInput) => string;
};

function getErrorKind(error: unknown): string {
	if (isClientError(error)) {
		return error.kind;
	}

	return error instanceof Error ? error.name : typeof error;
}

function getErrorCode(error: unknown): string | undefined {
	if (!isClientError(error)) {
		return undefined;
	}

	return error.code;
}

/**
 * エラーから表示メッセージを決定する
 *
 * preferErrorMessage=true の場合、ClientErrorが持つメッセージ（HTTPレイヤーで変換済み）を優先する。
 * デフォルトは false で、呼び出し側が指定した userMessage を使う。
 */
function getDefaultDisplayMessage({
	error,
	fallbackMessage,
	preferErrorMessage = false,
}: ResolveMessageInput & { preferErrorMessage?: boolean }): string {
	if (!preferErrorMessage) {
		return fallbackMessage;
	}

	if (isClientError(error)) {
		return error.message;
	}

	return fallbackMessage;
}

function getCaptureTarget(error: unknown, fallbackMessage: string): Error {
	if (isClientError(error) && error.clientError.cause instanceof Error) {
		return error.clientError.cause;
	}

	if (error instanceof Error) {
		return error;
	}

	return new Error(fallbackMessage);
}

export function isImportantErrorOperation(operation: ErrorOperation): boolean {
	return importantOperationSet.has(operation);
}

export function reportHandledError({
	error,
	operation,
	userMessage,
	context,
	ui = { type: "none" },
	preferErrorMessage = false,
	resolveMessage,
}: ReportHandledErrorOptions): string {
	const message =
		resolveMessage?.({ error, fallbackMessage: userMessage }) ??
		getDefaultDisplayMessage({
			error,
			fallbackMessage: userMessage,
			preferErrorMessage,
		});

	const errorKind = getErrorKind(error);
	const errorCode = getErrorCode(error);

	console.error(`[Handled Error] ${operation}`, {
		operation,
		errorKind,
		errorCode,
		displayMessage: message,
		context,
		error,
	});

	if (isImportantErrorOperation(operation)) {
		Sentry.withScope(scope => {
			scope.setLevel("error");
			scope.setTag("handled_error", "true");
			scope.setTag("operation", operation);
			scope.setTag("error_kind", errorKind);
			if (errorCode) {
				scope.setTag("error_code", errorCode);
			}
			if (context) {
				scope.setContext("error_context", context);
			}
			scope.setExtra("display_message", message);
			Sentry.captureException(getCaptureTarget(error, userMessage));
		});
	}

	switch (ui.type) {
		case "toast":
			toast.error(message);
			break;
		case "inline":
			ui.setError(message);
			break;
		case "none":
			break;
	}

	return message;
}
