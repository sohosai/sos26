import * as Sentry from "@sentry/bun";
import { env } from "./env";

if (env.SENTRY_DSN) {
	Sentry.init({
		dsn: env.SENTRY_DSN,
		environment: env.SENTRY_ENVIRONMENT,
		tracesSampleRate: 1.0,
	});
}
