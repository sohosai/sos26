import type { PushPayload } from "@sos26/shared";

export function noticeAuthorizationCancelledTemplate(params: {
	noticeTitle: string;
	url: string;
}): PushPayload {
	return {
		title: "お知らせの承認が取り消されました",
		body: params.noticeTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `notice:authorization-cancelled:${params.url}`,
		renotify: true,
		timestamp: Date.now(),
		data: {
			url: params.url,
			type: "NOTICE_AUTHORIZATION_CANCELLED",
		},
	};
}
