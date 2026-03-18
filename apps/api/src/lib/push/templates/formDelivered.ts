import type { PushPayload } from "@sos26/shared";

export function formDeliveredTemplate(params: {
	formTitle: string;
	url: string;
}): PushPayload {
	return {
		title: "新しい申請が配信されました",
		body: params.formTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `form:delivered:${params.url}`,
		renotify: false,
		timestamp: Date.now(),
		data: { url: params.url, type: "FORM_DELIVERED" },
	};
}
