import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./lib/env";
import { errorHandler } from "./lib/error-handler";
import { initPush } from "./lib/push/client";
import { authRoute } from "./routes/auth";
import { committeeFormRoute } from "./routes/committee-form";
import { committeeMemberRoute } from "./routes/committee-member";
import { committeeNoticeRoute } from "./routes/committee-notice";
import { committeeProjectRoute } from "./routes/committee-project";
import { projectRoute } from "./routes/project";
import { projectFormRoute } from "./routes/project-form";
import { projectNoticeRoute } from "./routes/project-notice";
import { pushRoute } from "./routes/push";

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

// Mount routes
app.route("/auth", authRoute);
app.route("/committee/members", committeeMemberRoute);
app.route("/committee/projects", committeeProjectRoute);
app.route("/committee/notices", committeeNoticeRoute);
app.route("committee/forms", committeeFormRoute);
app.route("/project", projectRoute);
app.route("/project", projectNoticeRoute);
app.route("/project/:projectId/forms", projectFormRoute);
app.route("/push", pushRoute);

export { app };

export default {
	port: env.PORT,
	fetch: app.fetch,
};
