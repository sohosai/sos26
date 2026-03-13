import type { PushPayload } from "@sos26/shared";

export function projectRegistrationFormAuthorizationRequestedTemplate(params: {
	formTitle: string;
	url: string;
}): PushPayload {
	return {
		title: "企画登録フォームの承認依頼が届きました",
		body: params.formTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `project-registration-form:authorization-requested:${params.url}`,
		renotify: true,
		requireInteraction: true,
		timestamp: Date.now(),
		data: {
			url: params.url,
			type: "PROJECT_REGISTRATION_FORM_AUTHORIZATION_REQUESTED",
		},
	};
}
