import type { BadgeProps } from "@radix-ui/themes";
import type {
	ApprovalStatus,
	ProjectRegistrationFormAuthorizationStatus,
} from "@sos26/shared";

export type FormDisplayStatus =
	| "DRAFT" // 公開申請前
	| "PENDING_APPROVAL" // 承認待ち
	| "REJECTED" // 却下
	| "SCHEDULED" // 承認済み・公開前
	| "PUBLISHED" // 公開済み
	| "EXPIRED"; // 期限切れ

export type FormStatusInfo = {
	label: string;
	color: BadgeProps["color"];
	code: FormDisplayStatus;
};

type AuthorizationSummary = {
	status: ApprovalStatus;
	deliveredAt: Date;
	deadlineAt: Date | null;
} | null;

/**
 * 承認情報と有効期間から申請の表示ステータスを判定する。
 * 一覧・詳細で共通して使用する。
 */
export function getFormStatusFromAuth(
	authorization: AuthorizationSummary
): FormStatusInfo {
	if (!authorization) {
		return { label: "公開申請前", color: "gray", code: "DRAFT" };
	}

	switch (authorization.status) {
		case "PENDING":
			return { label: "承認待機中", color: "orange", code: "PENDING_APPROVAL" };

		case "REJECTED":
			return { label: "却下", color: "red", code: "REJECTED" };

		case "APPROVED": {
			const now = new Date();

			// 期限切れチェック（承認済みの場合のみ意味がある）
			// allowLateResponse に関わらず、期限を過ぎていれば EXPIRED 表示
			if (authorization.deadlineAt && authorization.deadlineAt <= now) {
				return { label: "期間外", color: "gray", code: "EXPIRED" };
			}

			if (
				authorization.deliveredAt &&
				new Date(authorization.deliveredAt) > now
			) {
				return { label: "公開予定", color: "blue", code: "SCHEDULED" };
			}
			return { label: "公開済み", color: "green", code: "PUBLISHED" };
		}
	}
}

/**
 * isActive フラグと最新承認ステータスから企画登録フォームの表示ステータスを判定する。
 * 一覧・詳細で共通して使用する。
 */
export function getProjectRegistrationFormStatus(
	isActive: boolean,
	latestAuthStatus: ProjectRegistrationFormAuthorizationStatus | null
): FormStatusInfo {
	if (isActive) return { label: "公開済み", color: "green", code: "PUBLISHED" };
	if (latestAuthStatus === "PENDING")
		return { label: "承認待機中", color: "orange", code: "PENDING_APPROVAL" };
	if (latestAuthStatus === "REJECTED")
		return { label: "却下", color: "red", code: "REJECTED" };
	return { label: "下書き", color: "gray", code: "DRAFT" };
}
