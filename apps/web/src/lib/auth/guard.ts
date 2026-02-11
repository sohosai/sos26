import { redirect } from "@tanstack/react-router";
import { authReady, useAuthStore } from "./store";

/**
 * 保護ルートの beforeLoad で使用する認証チェック関数
 *
 * @param pathname - 現在のパス（returnTo 用）
 * @throws redirect - 認証に失敗した場合
 */
export async function requireAuth(pathname: string): Promise<void> {
	await authReady();

	const { user, isLoggedIn } = useAuthStore.getState();

	// 未ログイン → ログインページへ
	if (!isLoggedIn || !user) {
		throw redirect({
			to: "/auth/login",
			search: { returnTo: pathname },
		});
	}
}

/**
 * returnTo パラメータのバリデーション
 * オープンリダイレクト脆弱性を防ぐため、内部パスのみ許可
 *
 * @param returnTo - リダイレクト先のパス
 * @returns 安全なリダイレクト先（不正な場合は "/"）
 */
export function sanitizeReturnTo(returnTo: string | undefined): string {
	if (!returnTo) {
		return "/";
	}

	// 内部パスのみ許可（/ で始まり、// で始まらない）
	if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
		return returnTo;
	}

	// 不正なパスはホームへ
	return "/";
}
