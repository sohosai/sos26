import type { BadgeProps } from "@radix-ui/themes";
import type { FormAuthorizationStatus } from "@sos26/shared";

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
	status: FormAuthorizationStatus;
	deliveredAt: Date;
	allowLateResponse: boolean;
	deadlineAt: Date | null;
} | null;

/**
 * 承認情報と有効期間からフォームの表示ステータスを判定する。
 * 一覧・詳細で共通して使用する。
 */
export function getFormStatusFromAuth(
	authorization: AuthorizationSummary
): FormStatusInfo {
	const now = new Date();

	// 期限切れ
	if (authorization?.deadlineAt && authorization.deadlineAt < now) {
		return { label: "期間外", color: "gray", code: "EXPIRED" };
	}

	if (!authorization) {
		return { label: "公開申請前", color: "gray", code: "DRAFT" };
	}

	switch (authorization.status) {
		case "PENDING":
			return { label: "承認待機中", color: "orange", code: "PENDING_APPROVAL" };

		case "REJECTED":
			return { label: "却下", color: "red", code: "REJECTED" };

		case "APPROVED": {
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
