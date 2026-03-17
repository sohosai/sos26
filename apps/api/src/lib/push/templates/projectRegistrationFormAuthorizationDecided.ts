import type { PushPayload } from "@sos26/shared";

export function projectRegistrationFormAuthorizationDecidedTemplate(params: {
	formTitle: string;
	status: "APPROVED" | "REJECTED";
	url: string;
}): PushPayload {
	return {
		title: `企画登録フォームの承認依頼が${params.status === "APPROVED" ? "承認" : "却下"}されました`,
		body: params.formTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `project-registration-form:authorization-decided:${params.url}`,
		renotify: true,
		timestamp: Date.now(),
		data: {
			url: params.url,
			type: "PROJECT_REGISTRATION_FORM_AUTHORIZATION_DECIDED",
			status: params.status,
		},
	};
}
