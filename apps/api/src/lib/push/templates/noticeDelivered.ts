import type { PushPayload } from "@sos26/shared";

export function noticeDeliveredTemplate(params: {
	noticeTitle: string;
}): PushPayload {
	return { title: "新しいお知らせが公開されました", body: params.noticeTitle };
}
