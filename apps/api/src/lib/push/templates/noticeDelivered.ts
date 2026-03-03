import type { PushPayload } from "@sos26/shared";

export function noticeDeliveredTemplate(params: {
	noticeTitle: string;
	url: string;
}): PushPayload {
	return {
		title: "新しいお知らせが公開されました",
		body: params.noticeTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `notice:delivered:${params.url}`,
		renotify: false,
		timestamp: Date.now(),
		data: { url: params.url, type: "NOTICE_DELIVERED" },
	};
}
