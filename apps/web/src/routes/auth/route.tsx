import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { authReady, sanitizeReturnTo, useAuthStore } from "@/lib/auth";

const searchSchema = z.object({
	returnTo: z.string().optional(),
});

/**
 * /auth 配下のレイアウトルート
 * ログイン済みユーザーは returnTo (またはホーム) へリダイレクトする
 */
export const Route = createFileRoute("/auth")({
	validateSearch: searchSchema,
	beforeLoad: async ({ search }) => {
		await authReady();
		const { isLoggedIn } = useAuthStore.getState();
		if (isLoggedIn) {
			throw redirect({ to: sanitizeReturnTo(search.returnTo) });
		}
	},
	component: AuthLayout,
});

function AuthLayout() {
	return <Outlet />;
}
