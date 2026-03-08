import type { PushPayload } from "@sos26/shared";

export function accessRequestDecidedTemplate(params: {
	columnName: string;
	status: "APPROVED" | "REJECTED";
	url: string;
}): PushPayload {
	return {
		title: `マスターシートのアクセス申請が${params.status === "APPROVED" ? "承認" : "却下"}されました`,
		body: params.columnName,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `access-request:decided:${params.url}`,
		renotify: true,
		timestamp: Date.now(),
		data: {
			url: params.url,
			type: "ACCESS_REQUEST_DECIDED",
			status: params.status,
		},
	};
}
