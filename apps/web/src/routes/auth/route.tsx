import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/auth";

/**
 * /auth 配下のレイアウトルート
 * ログイン済みユーザーはホームへリダイレクトする
 */
export const Route = createFileRoute("/auth")({
	beforeLoad: () => {
		const { isLoggedIn } = useAuthStore.getState();
		if (isLoggedIn) {
			throw redirect({ to: "/" });
		}
	},
	component: AuthLayout,
});

function AuthLayout() {
	return <Outlet />;
}
