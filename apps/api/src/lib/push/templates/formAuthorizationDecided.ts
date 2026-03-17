import type { PushPayload } from "@sos26/shared";

export function formAuthorizationDecidedTemplate(params: {
	formTitle: string;
	status: "APPROVED" | "REJECTED";
	url: string;
}): PushPayload {
	return {
		title: `申請承認が${params.status === "APPROVED" ? "承認" : "却下"}されました`,
		body: params.formTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `form:authorization-decided:${params.url}`,
		renotify: true,
		timestamp: Date.now(),
		data: {
			url: params.url,
			type: "FORM_AUTHORIZATION_DECIDED",
			status: params.status,
		},
	};
}
