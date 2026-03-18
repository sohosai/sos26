import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	build: {
		sourcemap: true,
	},
	plugins: [
		tanstackRouter({
			target: "react",
		}),
		react(),
		sentryVitePlugin({
			authToken: process.env.VITE_SENTRY_AUTH_TOKEN,
			org: process.env.VITE_SENTRY_ORG,
			project: process.env.VITE_SENTRY_PROJECT,
			disable: !process.env.VITE_SENTRY_AUTH_TOKEN,
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		port: 5173,
	},
});
