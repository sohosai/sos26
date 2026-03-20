import { ErrorCode } from "@sos26/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientErrorClass } from "../http/error";

const sentryMocks = vi.hoisted(() => {
	const captureException = vi.fn();
	const withScope = vi.fn(
		(
			callback: (scope: {
				setLevel: ReturnType<typeof vi.fn>;
				setTag: ReturnType<typeof vi.fn>;
				setContext: ReturnType<typeof vi.fn>;
				setExtra: ReturnType<typeof vi.fn>;
			}) => void
		) =>
			callback({
				setLevel: vi.fn(),
				setTag: vi.fn(),
				setContext: vi.fn(),
				setExtra: vi.fn(),
			})
	);

	return {
		captureException,
		withScope,
	};
});

const toastError = vi.hoisted(() => vi.fn());

vi.mock("@sentry/react", () => sentryMocks);
vi.mock("sonner", () => ({
	toast: {
		error: toastError,
	},
}));

import { reportHandledError } from "./report";

describe("reportHandledError", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("read errors are logged and toasted without sending to Sentry", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		const error = new Error("boom");
		const message = reportHandledError({
			error,
			operation: "read",
			userMessage: "一覧の取得に失敗しました",
			ui: { type: "toast" },
			context: { screen: "project_forms" },
		});

		expect(message).toBe("一覧の取得に失敗しました");
		expect(consoleErrorSpy).toHaveBeenCalledWith("[Handled Error] read", {
			operation: "read",
			errorKind: "Error",
			errorCode: undefined,
			displayMessage: "一覧の取得に失敗しました",
			context: { screen: "project_forms" },
			error,
		});
		expect(toastError).toHaveBeenCalledWith("一覧の取得に失敗しました");
		expect(sentryMocks.withScope).not.toHaveBeenCalled();
		expect(sentryMocks.captureException).not.toHaveBeenCalled();
	});

	it("important operations send handled errors to Sentry", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const rawError = new TypeError("Failed to fetch");
		const error = new ClientErrorClass({
			kind: "network",
			message: "ネットワークエラーが発生しました",
			cause: rawError,
		});

		const message = reportHandledError({
			error,
			operation: "submit",
			userMessage: "送信に失敗しました",
			preferErrorMessage: true,
			context: { formId: "form-1" },
		});

		expect(message).toBe("ネットワークエラーが発生しました");
		expect(consoleErrorSpy).toHaveBeenCalled();
		expect(sentryMocks.withScope).toHaveBeenCalledOnce();
		expect(sentryMocks.captureException).toHaveBeenCalledWith(rawError);
	});

	it("custom resolvers can override inline messages", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const setError = vi.fn();
		const error = new ClientErrorClass({
			kind: "api",
			error: {
				error: {
					code: ErrorCode.TOKEN_INVALID,
					message: "無効なトークンです",
				},
			},
		});

		const message = reportHandledError({
			error,
			operation: "submit",
			userMessage: "エラーが発生しました",
			ui: { type: "inline", setError },
			resolveMessage: ({ error, fallbackMessage }) => {
				if (
					error instanceof ClientErrorClass &&
					error.code === ErrorCode.TOKEN_INVALID
				) {
					return "セッションが期限切れです。最初からやり直してください。";
				}

				return fallbackMessage;
			},
		});

		expect(message).toBe(
			"セッションが期限切れです。最初からやり直してください。"
		);
		expect(setError).toHaveBeenCalledWith(
			"セッションが期限切れです。最初からやり直してください。"
		);
		expect(consoleErrorSpy).toHaveBeenCalled();
		expect(sentryMocks.withScope).toHaveBeenCalledOnce();
	});
});
