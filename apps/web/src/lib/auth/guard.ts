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

/**
 * サイドバー表示制御用に MEMBER_EDIT 権限を事前取得する
 * beforeLoad で呼び出すことで、初回描画時のチラつきを防ぐ
 */
export async function preloadMemberEditPermission(): Promise<void> {
	const { isCommitteeMember } = useAuthStore.getState();

	if (!isCommitteeMember) {
		useAuthStore.setState({ hasMemberEditPermission: false });
		return;
	}

	try {
		const res = await getMyPermissions();
		useAuthStore.setState({
			hasMemberEditPermission: res.permissions.some(
				p => p.permission === "MEMBER_EDIT"
			),
		});
	} catch {
		useAuthStore.setState({ hasMemberEditPermission: false });
	}
}

/**
 * サイドバー表示制御用に企画登録関連権限を事前取得する
 * beforeLoad で呼び出すことで、初回描画時のチラつきを防ぐ
 */
export async function preloadProjectRegistrationPermission(): Promise<void> {
	const { isCommitteeMember } = useAuthStore.getState();

	if (!isCommitteeMember) {
		useAuthStore.setState({ hasProjectRegistrationPermission: false });
		return;
	}

	try {
		const res = await getMyPermissions();
		useAuthStore.setState({
			hasProjectRegistrationPermission: res.permissions.some(
				p =>
					p.permission === "PROJECT_REGISTRATION_FORM_CREATE" ||
					p.permission === "PROJECT_REGISTRATION_FORM_DELIVER"
			),
		});
	} catch {
		useAuthStore.setState({ hasProjectRegistrationPermission: false });
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
