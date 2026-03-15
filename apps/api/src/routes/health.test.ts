// @ts-nocheck - テストファイルでは res.json() の unknown 型を許容
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../lib/error-handler";
import { healthRoute } from "./health";

function makeApp() {
	const app = new Hono();
	app.onError(errorHandler);
	app.route("/health", healthRoute);
	return app;
}

describe("GET /health", () => {
	it("正常系: 200 OK を返す", async () => {
		const app = makeApp();

		const res = await app.request("/health");

		expect(res.status).toBe(200);
		await expect(res.text()).resolves.toBe("");
	});
});
