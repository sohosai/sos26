import type { PushPayload } from "@sos26/shared";

export function formAuthorizationCancelledTemplate(params: {
	formTitle: string;
	url: string;
}): PushPayload {
	return {
		title: "申請の承認が取り消されました",
		body: params.formTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `form:authorization-cancelled:${params.url}`,
		renotify: true,
		timestamp: Date.now(),
		data: {
			url: params.url,
			type: "FORM_AUTHORIZATION_CANCELLED",
		},
	};
}
