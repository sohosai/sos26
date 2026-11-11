import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
	Sentry.init({
		dsn,
		environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
		integrations: [Sentry.browserTracingIntegration()],
		tracesSampleRate: 1.0,
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,
	});

	Sentry.lazyLoadIntegration("replayIntegration").then(replayIntegration => {
		Sentry.addIntegration(replayIntegration());
	});
}
