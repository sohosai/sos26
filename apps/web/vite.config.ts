import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv, type PluginOption } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	return {
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
			}) as unknown as PluginOption,
		],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
		server: {
			host: "0.0.0.0",
			port: 5173,
			proxy: {
				"/openapi": {
					target: env.VITE_API_BASE_URL || "http://localhost:3000",
					changeOrigin: true,
				},
			},
		},
	};
});
