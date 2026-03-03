import type { PushPayload } from "@sos26/shared";

export function noticeAuthorizationRequestedTemplate(params: {
	noticeTitle: string;
	url: string;
}): PushPayload {
	return {
		title: "お知らせ承認依頼が届きました",
		body: params.noticeTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `notice:authorization-requested:${params.url}`,
		renotify: true,
		requireInteraction: true,
		timestamp: Date.now(),
		data: { url: params.url, type: "NOTICE_AUTHORIZATION_REQUESTED" },
	};
}
