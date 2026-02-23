import type { BadgeProps } from "@radix-ui/themes";
import type { FormAuthorizationStatus } from "@sos26/shared";

export type FormStatusInfo = {
	label: string;
	color: BadgeProps["color"];
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
		return { label: "期間外", color: "gray" };
	}

	if (!authorization) {
		return { label: "公開申請前", color: "gray" };
	}

	switch (authorization.status) {
		case "PENDING":
			return { label: "承認待機中", color: "orange" };

		case "REJECTED":
			return { label: "却下", color: "red" };

		case "APPROVED": {
			if (
				authorization.deliveredAt &&
				new Date(authorization.deliveredAt) > now
			) {
				return { label: "公開予定", color: "blue" };
			}
			return { label: "公開済み", color: "green" };
		}
	}
}
