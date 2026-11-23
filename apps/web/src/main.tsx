import "./lib/sentry";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { useAuthStore } from "./lib/auth";
import { queryClient } from "./lib/query/client";
import { routeTree } from "./routeTree.gen";

import "./styles/index.css";

// Create a new router instance
const router = createRouter({ routeTree, scrollRestoration: true });

// 前のユーザーの取得結果を次のユーザーに見せない。ルーターも離れた画面の loader の結果を持っているので、両方を捨てる。
// 別のタブでのログインなどでサインアウトを経ずに替わった場合に備え、表示中の画面も取り直す
useAuthStore.subscribe((state, prev) => {
	if (state.firebaseUser?.uid !== prev.firebaseUser?.uid) {
		queryClient.clear();
		router.clearCache();
		// 起動時のログインでは表示中の画面がまだ読み込み中なので、前のユーザーがいたときだけにする
		if (prev.firebaseUser) void router.invalidate();
	}
});

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
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
			<Toaster />
		</QueryClientProvider>
	</StrictMode>
);
