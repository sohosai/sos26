import type { BadgeProps } from "@radix-ui/themes";
import type { NoticeAuthorizationStatus } from "@sos26/shared";

export type NoticeStatusInfo = {
	label: string;
	color: BadgeProps["color"];
};

type AuthorizationSummary = {
	status: NoticeAuthorizationStatus;
	deliveredAt: Date;
} | null;

/**
 * 承認情報からお知らせの表示ステータスを判定する。
 * 一覧・詳細で共通して使用する。
 */
export function getNoticeStatusFromAuth(
	authorization: AuthorizationSummary
): NoticeStatusInfo {
	if (!authorization) {
		return { label: "公開申請前", color: "gray" };
	}
	switch (authorization.status) {
		case "PENDING":
			return { label: "承認待機中", color: "orange" };
		case "REJECTED":
			return { label: "却下", color: "red" };
		case "APPROVED": {
			if (new Date(authorization.deliveredAt) > new Date()) {
				return { label: "公開予定", color: "blue" };
			}
			return { label: "公開済み", color: "green" };
		}
	}
}
