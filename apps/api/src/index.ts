import "./lib/sentry";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./lib/env";
import { errorHandler } from "./lib/error-handler";
import { initPush } from "./lib/push/client";
import { initStorage } from "./lib/storage/client";
import { authRoute } from "./routes/auth";
import { committeeFormRoute } from "./routes/committee-form";
import { committeeInquiryRoute } from "./routes/committee-inquiry";
import { committeeMastersheetRoute } from "./routes/committee-mastersheet";
import { committeeMemberRoute } from "./routes/committee-member";
import { committeeNoticeRoute } from "./routes/committee-notice";
import { committeeProjectRoute } from "./routes/committee-project";
import { committeeProjectRegistrationFormRoute } from "./routes/committee-project-registration-form";
import { committeeUserRoute } from "./routes/committee-user";
import { fileRoute } from "./routes/files";
import { healthRoute } from "./routes/health";
import { projectRoute } from "./routes/project";
import { projectFormRoute } from "./routes/project-form";
import { projectInquiryRoute } from "./routes/project-inquiry";
import { projectNoticeRoute } from "./routes/project-notice";
import { pushRoute } from "./routes/push";
import { userRoute } from "./routes/user";

// Push 初期化
initPush();

// Storage 初期化
initStorage();

// ファイルアクセスチェッカー登録
import "./lib/storage/checkers";

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
app.route("/health", healthRoute);
app.route("/auth", authRoute);
app.route("/committee/members", committeeMemberRoute);
app.route("/committee/projects", committeeProjectRoute);
app.route("/committee/notices", committeeNoticeRoute);
app.route("/committee/forms", committeeFormRoute);
app.route("/committee/inquiries", committeeInquiryRoute);
app.route(
	"/committee/project-registration-forms",
	committeeProjectRegistrationFormRoute
);
app.route("/committee/mastersheet", committeeMastersheetRoute);
app.route("/committee/users", committeeUserRoute);
app.route("/project/:projectId/forms", projectFormRoute);
app.route("/project", projectRoute);
app.route("/project", projectNoticeRoute);
app.route("/project", projectInquiryRoute);
app.route("/push", pushRoute);
app.route("/user", userRoute);
app.route("/files", fileRoute);

export { app };

export default {
	port: env.PORT,
	fetch: app.fetch,
};
