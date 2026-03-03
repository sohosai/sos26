import type { PushPayload } from "@sos26/shared";

export function noticeAuthorizationRequestedTemplate(params: {
	noticeTitle: string;
}): PushPayload {
	return { title: "お知らせ承認依頼が届きました", body: params.noticeTitle };
}
