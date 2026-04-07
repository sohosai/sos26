import type { PushPayload } from "@sos26/shared";

export function subOwnerRequestSentTemplate(params: {
	projectName: string;
	url: string;
}): PushPayload {
	return {
		title: "副企画責任者への指名依頼が届きました",
		body: params.projectName,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `sub-owner-request:sent:${params.url}`,
		renotify: true,
		requireInteraction: true,
		timestamp: Date.now(),
		data: { url: params.url, type: "SUB_OWNER_REQUEST_SENT" },
	};
}
