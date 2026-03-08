import type { PushPayload } from "@sos26/shared";

export function subOwnerRequestRejectedTemplate(params: {
	projectName: string;
	url: string;
}): PushPayload {
	return {
		title: "副責任者リクエストが辞退されました",
		body: params.projectName,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `sub-owner-request:rejected:${params.url}`,
		renotify: true,
		timestamp: Date.now(),
		data: { url: params.url, type: "SUB_OWNER_REQUEST_REJECTED" },
	};
}
