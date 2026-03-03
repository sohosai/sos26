import type { PushPayload } from "@sos26/shared";

export function formAuthorizationRequestedTemplate(params: {
	formTitle: string;
}): PushPayload {
	return { title: "フォーム承認依頼が届きました", body: params.formTitle };
}
