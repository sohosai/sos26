import type { PushPayload } from "@sos26/shared";

export function inquiryCreatedForProjectTemplate(params: {
	inquiryTitle: string;
}): PushPayload {
	return {
		title: "実行委員会からお問い合わせが作成されました",
		body: params.inquiryTitle,
	};
}
