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
import { committeeMapSettingsRoute } from "./routes/committee-map-settings";
import { committeeMastersheetRoute } from "./routes/committee-mastersheet";
import { committeeMemberRoute } from "./routes/committee-member";
import { committeeNoticeRoute } from "./routes/committee-notice";
import { committeeProjectRoute } from "./routes/committee-project";
import { committeeProjectRegistrationFormRoute } from "./routes/committee-project-registration-form";
import { committeeUserRoute } from "./routes/committee-user";
import { fileRoute } from "./routes/files";
import { healthRoute } from "./routes/health";
import { internalNotificationRoute } from "./routes/internal-notification";
import { openApiRoute } from "./routes/openapi";
import { projectRoute } from "./routes/project";
import { projectFormRoute } from "./routes/project-form";
import { projectInquiryRoute } from "./routes/project-inquiry";
import { projectNoticeRoute } from "./routes/project-notice";
import { projectPublicInfoRoute } from "./routes/project-public-info";
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

// 公開API（オンラインマップ等の外部アプリ向け）
// 認証不要・読み取り専用のため全オリジンから利用できる。
// 認証情報を送らせないよう credentials は付けない。
// 後段の CORS より先に登録し、このルートには適用されないようにしている。
app.use(
	"/openapi/*",
	cors({
		origin: "*",
		allowMethods: ["GET"],
		maxAge: 86400,
	})
);
app.route("/openapi", openApiRoute);

// CORS（認証付きAPI向け）
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
app.route("/internal/notifications", internalNotificationRoute);
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
app.route("/project", projectPublicInfoRoute);
app.route("/push", pushRoute);
app.route("/user", userRoute);
app.route("/files", fileRoute);
app.route("/committee/map-settings", committeeMapSettingsRoute);

export { app };

export default {
	port: env.PORT,
	fetch: app.fetch,
};
