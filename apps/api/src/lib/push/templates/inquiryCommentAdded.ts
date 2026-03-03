import type { PushPayload } from "@sos26/shared";

export function inquiryCommentAddedTemplate(params: {
	inquiryTitle: string;
}): PushPayload {
	return {
		title: "お問い合わせに新しいコメントが追加されました",
		body: params.inquiryTitle,
	};
}
