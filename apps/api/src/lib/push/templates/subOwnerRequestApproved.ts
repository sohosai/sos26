import type { PushPayload } from "@sos26/shared";

export function subOwnerRequestApprovedTemplate(params: {
	projectName: string;
	url: string;
}): PushPayload {
	return {
		title: "副企画責任者リクエストが承認されました",
		body: params.projectName,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `sub-owner-request:approved:${params.url}`,
		renotify: true,
		timestamp: Date.now(),
		data: { url: params.url, type: "SUB_OWNER_REQUEST_APPROVED" },
	};
}
