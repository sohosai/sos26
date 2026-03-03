import type { PushPayload } from "@sos26/shared";

export function noticeAuthorizationDecidedTemplate(params: {
	noticeTitle: string;
	status: "APPROVED" | "REJECTED";
	url: string;
}): PushPayload {
	return {
		title: `お知らせ承認が${params.status === "APPROVED" ? "承認" : "却下"}されました`,
		body: params.noticeTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `notice:authorization-decided:${params.url}`,
		renotify: true,
		timestamp: Date.now(),
		data: {
			url: params.url,
			type: "NOTICE_AUTHORIZATION_DECIDED",
			status: params.status,
		},
	};
}
