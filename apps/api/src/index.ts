import { Hono } from "hono";
import { cors } from "hono/cors";
import { initPush } from "./infra/push/client";
import { env } from "./lib/env";
import { errorHandler } from "./lib/error-handler";
import { pushRoute } from "./routes/push";
import { userRoute } from "./routes/user";

// Push 初期化
initPush();

const app = new Hono();

// 統一エラーハンドラ
app.onError(errorHandler);

// CORS
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
		allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
		credentials: true,
		maxAge: 86400,
	})
);

app.get("/", c => {
	return c.text("Hello Hono!");
});

// Mount routes at root (e.g. http://localhost:3000/users)
app.route("/", userRoute);

app.route("/", pushRoute);

export default {
	port: env.PORT,
	fetch: app.fetch,
};
