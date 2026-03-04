import type { PushPayload } from "@sos26/shared";

export function inquiryAssigneeAddedTemplate(params: {
	inquiryTitle: string;
	url: string;
}): PushPayload {
	return {
		title: "お問い合わせの担当者に追加されました",
		body: params.inquiryTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `inquiry:assignee-added:${params.url}`,
		renotify: true,
		timestamp: Date.now(),
		data: { url: params.url, type: "INQUIRY_ASSIGNEE_ADDED" },
	};
}
