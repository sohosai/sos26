import "./lib/sentry";
import { applyGoogleTranslatePatch } from "./lib/google-translate-patch";

// Google 翻訳による DOM 改変と React reconciler の競合を防ぐ
// ※ React の import および createRoot() より前に実行する必要がある
applyGoogleTranslatePatch();

import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { routeTree } from "./routeTree.gen";

import "./styles/index.css";

// Create a new router instance
const router = createRouter({ routeTree, scrollRestoration: true });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

// チャンクの取得に失敗したらリロードして最新の版を読み直す。失敗が続くときに繰り返さないよう、版とエラーごとに1回までとする
// Safari のエラーメッセージは URL を含まないので、次のデプロイでも再度リロードできるようキーに版（エントリの URL）を含める
window.addEventListener("vite:preloadError", event => {
	const storageKey = `sos26.preloadReload:${import.meta.url}:${event.payload.message}`;
	if (sessionStorage.getItem(storageKey)) return;
	sessionStorage.setItem(storageKey, "1");
	window.location.reload();
});

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element not found");
}

createRoot(rootElement).render(
	<StrictMode>
		<RouterProvider router={router} />
		<Toaster />
	</StrictMode>
);
