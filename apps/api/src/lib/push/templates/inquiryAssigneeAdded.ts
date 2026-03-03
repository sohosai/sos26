import type { PushPayload } from "@sos26/shared";

export function inquiryAssigneeAddedTemplate(params: {
	inquiryTitle: string;
}): PushPayload {
	return {
		title: "お問い合わせの担当者に追加されました",
		body: params.inquiryTitle,
	};
}
