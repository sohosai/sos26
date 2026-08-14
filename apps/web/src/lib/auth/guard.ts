import type { CommitteePermission } from "@sos26/shared";
import { redirect } from "@tanstack/react-router";
import { getMyPermissions } from "../api/committee-member";
import { authReady, useAuthStore } from "./store";

/**
 * 権限不足を示すエラー
 * errorComponent でキャッチして 403 画面をその場で表示するために使う
 */
export class ForbiddenError extends Error {
	constructor(message = "アクセス権限がありません") {
		super(message);
		this.name = "ForbiddenError";
	}
}

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
 * 委員メンバー専用ルートの beforeLoad で使用する認可チェック関数
 * requireAuth の後に呼び出すこと
 *
 * @throws redirect - 委員メンバーでない場合
 */
export async function requireCommitteeMember(): Promise<void> {
	const { isCommitteeMember } = useAuthStore.getState();

	if (!isCommitteeMember) {
		throw new ForbiddenError();
	}
}

const NO_COMMITTEE_PERMISSIONS = {
	hasMemberEditPermission: false,
	hasProjectRegistrationPermission: false,
	hasMapAppSettingPermission: false,
} as const;

/**
 * サイドバー表示制御用に実委人の権限を事前取得する
 * beforeLoad で呼び出すことで、初回描画時のチラつきを防ぐ
 */
export async function preloadCommitteePermissions(): Promise<void> {
	const { isCommitteeMember } = useAuthStore.getState();

	if (!isCommitteeMember) {
		useAuthStore.setState(NO_COMMITTEE_PERMISSIONS);
		return;
	}

	try {
		const res = await getMyPermissions();
		const has = (permission: CommitteePermission) =>
			res.permissions.some(p => p.permission === permission);

		useAuthStore.setState({
			hasMemberEditPermission: has("MEMBER_EDIT"),
			hasProjectRegistrationPermission:
				has("PROJECT_REGISTRATION_FORM_CREATE") ||
				has("PROJECT_REGISTRATION_FORM_DELIVER"),
			hasMapAppSettingPermission: has("MAP_APP_SETTING_EDIT"),
		});
	} catch {
		useAuthStore.setState(NO_COMMITTEE_PERMISSIONS);
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
