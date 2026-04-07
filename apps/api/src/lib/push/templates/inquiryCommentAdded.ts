import type { PushPayload } from "@sos26/shared";

export function inquiryCommentAddedTemplate(params: {
	inquiryTitle: string;
	url: string;
}): PushPayload {
	return {
		title: "お問い合わせに新しい返信がありました",
		body: params.inquiryTitle,
		icon: "/sos.svg",
		badge: "/sos.svg",
		lang: "ja-JP",
		tag: `inquiry:comment-added:${params.url}`,
		renotify: true,
		timestamp: Date.now(),
		data: { url: params.url, type: "INQUIRY_COMMENT_ADDED" },
	};
}
