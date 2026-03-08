import type { PushPayload } from "@sos26/shared";

export function formAuthorizationRequestedTemplate(params: {
	formTitle: string;
	url: string;
}): PushPayload {
	return {
		title: "フォーム承認依頼が届きました",
		body: params.formTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `form:authorization-requested:${params.url}`,
		renotify: true,
		requireInteraction: true,
		timestamp: Date.now(),
		data: { url: params.url, type: "FORM_AUTHORIZATION_REQUESTED" },
	};
}
