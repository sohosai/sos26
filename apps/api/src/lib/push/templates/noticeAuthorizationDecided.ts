import type { PushPayload } from "@sos26/shared";

export function noticeAuthorizationDecidedTemplate(params: {
	noticeTitle: string;
	status: "APPROVED" | "REJECTED";
}): PushPayload {
	return {
		title: `お知らせ承認が${params.status === "APPROVED" ? "承認" : "却下"}されました`,
		body: params.noticeTitle,
	};
}
