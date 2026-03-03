import type { PushPayload } from "@sos26/shared";

export function inquiryCreatedForCommitteeTemplate(params: {
	inquiryTitle: string;
	url: string;
}): PushPayload {
	return {
		title: "企画からお問い合わせが作成されました",
		body: params.inquiryTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `inquiry:created:committee:${params.url}`,
		renotify: false,
		timestamp: Date.now(),
		data: { url: params.url, type: "INQUIRY_CREATED_FOR_COMMITTEE" },
	};
}
