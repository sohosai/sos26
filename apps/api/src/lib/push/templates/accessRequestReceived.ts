import type { PushPayload } from "@sos26/shared";

export function accessRequestReceivedTemplate(params: {
	columnName: string;
	url: string;
}): PushPayload {
	return {
		title: "マスターシートのアクセス申請が届きました",
		body: params.columnName,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `access-request:received:${params.url}`,
		renotify: true,
		requireInteraction: true,
		timestamp: Date.now(),
		data: { url: params.url, type: "ACCESS_REQUEST_RECEIVED" },
	};
}
