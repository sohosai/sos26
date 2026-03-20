import * as Sentry from "@sentry/bun";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Errors } from "./error";
import { errorHandler } from "./error-handler";

vi.mock("@sentry/bun", () => ({
	captureException: vi.fn(),
}));

function makeApp() {
	const app = new Hono();
	app.onError(errorHandler);
	app.get("/app-error", () => {
		throw Errors.forbidden("権限がありません");
	});
	app.post("/validation-error", async c => {
		const body = await c.req.json().catch(() => ({}));
		z.object({ name: z.string().min(1) }).parse(body);
		return c.json({ ok: true });
	});
	app.get("/unexpected", () => {
		throw new Error("boom");
	});
	return app;
}

describe("errorHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("AppErrorはSentryに送らずそのまま返す", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const app = makeApp();

		const res = await app.request("/app-error");
		const body = await res.json();

		expect(res.status).toBe(403);
		expect(body.error.code).toBe("FORBIDDEN");
		expect(Sentry.captureException).not.toHaveBeenCalled();
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it("ZodErrorは400に正規化しSentryに送らない", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const app = makeApp();

		const res = await app.request("/validation-error", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "" }),
		});
		const body = await res.json();

		expect(res.status).toBe(400);
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(Sentry.captureException).not.toHaveBeenCalled();
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it("unexpected errorはconsoleとSentryの両方に残す", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const app = makeApp();

		const res = await app.request("/unexpected");
		const body = await res.json();

		expect(res.status).toBe(500);
		expect(body.error.code).toBe("INTERNAL");
		expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
		expect(consoleErrorSpy).toHaveBeenCalledWith("[Internal Error]", {
			method: "GET",
			path: "/unexpected",
			error: expect.any(Error),
		});
	});
});
