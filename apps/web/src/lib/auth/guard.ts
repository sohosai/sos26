import type { UserRole } from "@sos26/shared";
import { redirect } from "@tanstack/react-router";
import { authReady, useAuthStore } from "./store";

/**
 * 保護ルートの beforeLoad で使用する認可チェック関数
 *
 * @param allowedRoles - 許可するロールの配列
 * @param pathname - 現在のパス（returnTo 用）
 * @throws redirect - 認証・認可に失敗した場合
 */
export async function requireAuth(
	allowedRoles: readonly UserRole[],
	pathname: string
): Promise<void> {
	await authReady();

	const { user, isLoggedIn } = useAuthStore.getState();

	// 未ログイン → ログインページへ
	if (!isLoggedIn || !user) {
		throw redirect({
			to: "/auth/login",
			search: { returnTo: pathname },
		});
	}

	// DISABLED ユーザー → 403
	if (user.status !== "ACTIVE") {
		throw redirect({ to: "/forbidden" });
	}

	// ロール不足 → 403
	if (!allowedRoles.includes(user.role)) {
		throw redirect({ to: "/forbidden" });
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

	// URL エンコード・バックスラッシュを正規化してバイパス対策
	let decoded: string;
	try {
		decoded = decodeURIComponent(returnTo).replace(/\\/g, "/");
	} catch {
		return "/";
	}

	// javascript: や data: スキームを除外
	if (/^(javascript|data|vbscript)\s*:/i.test(decoded.trimStart())) {
		return "/";
	}

	// 内部パスのみ許可（正規化後に / で始まり、// で始まらない）
	if (decoded.startsWith("/") && !decoded.startsWith("//")) {
		return decoded;
	}

	// 不正なパスはホームへ
	return "/";
}
