import type { ReactNode } from "react";
import { useAuthStore } from "@/lib/auth";

export interface RoleGuardProps {
	/** 条件を満たさない場合の代替表示（省略時は null） */
	fallback?: ReactNode;
	children: ReactNode;
}

/**
 * 認証済みユーザーにのみ UI を表示するガードコンポーネント
 *
 * @example
 * ```tsx
 * <RoleGuard>
 *   <AdminPanel />
 * </RoleGuard>
 *
 * <RoleGuard fallback={<p>ログインが必要です</p>}>
 *   <SystemSettings />
 * </RoleGuard>
 * ```
 *
 * @note このコンポーネントはクライアントサイドの表示制御のみを行います。
 * セキュリティ上重要な操作は、API 側でも必ず権限を検証してください。
 */
export function RoleGuard({ fallback = null, children }: RoleGuardProps) {
	const { user } = useAuthStore();

	if (!user) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
}
