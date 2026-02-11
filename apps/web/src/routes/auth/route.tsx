import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Header } from "@/components/layout/Header/Header";
import { useAuthStore } from "@/lib/auth";
import styles from "./route.module.scss";

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
	return (
		<div className={styles.layout}>
			<Header />
			<main className={styles.main}>
				<Outlet />
			</main>
		</div>
	);
}
