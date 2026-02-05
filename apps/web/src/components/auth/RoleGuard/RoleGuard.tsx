import type { UserRole } from "@sos26/shared";
import type { ReactNode } from "react";
import { useAuthStore } from "@/lib/auth";

export interface RoleGuardProps {
	/** 表示を許可するロール */
	allowedRoles: UserRole[];
	/** 条件を満たさない場合の代替表示（省略時は null） */
	fallback?: ReactNode;
	children: ReactNode;
}

/**
 * 特定のロールを持つユーザーにのみ UI を表示するガードコンポーネント
 *
 * @example
 * ```tsx
 * // 管理者のみに表示
 * <RoleGuard allowedRoles={["COMMITTEE_ADMIN", "SYSTEM_ADMIN"]}>
 *   <AdminPanel />
 * </RoleGuard>
 *
 * // 権限がない場合にメッセージを表示
 * <RoleGuard
 *   allowedRoles={["SYSTEM_ADMIN"]}
 *   fallback={<p>この機能を利用する権限がありません</p>}
 * >
 *   <SystemSettings />
 * </RoleGuard>
 * ```
 *
 * @note このコンポーネントはクライアントサイドの表示制御のみを行います。
 * セキュリティ上重要な操作は、API 側でも必ず権限を検証してください。
 */
export function RoleGuard({
	allowedRoles,
	fallback = null,
	children,
}: RoleGuardProps) {
	const { user } = useAuthStore();

	if (!user || !allowedRoles.includes(user.role)) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
}
