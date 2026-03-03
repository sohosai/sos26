import type { PushPayload } from "@sos26/shared";

export function inquiryCreatedForCommitteeTemplate(params: {
	inquiryTitle: string;
}): PushPayload {
	return {
		title: "企画からお問い合わせが作成されました",
		body: params.inquiryTitle,
	};
}
