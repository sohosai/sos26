import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// GET は HTTP クライアントで 1 回再試行しているので、ここでは重ねない
			retry: false,
			// /project 配下の画面は notification-status の変化を見て取り直す
			refetchOnWindowFocus: false,
		},
	},
});
