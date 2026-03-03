import type { PushPayload } from "@sos26/shared";

export function formAuthorizationDecidedTemplate(params: {
	formTitle: string;
	status: "APPROVED" | "REJECTED";
}): PushPayload {
	return {
		title: `フォーム承認が${params.status === "APPROVED" ? "承認" : "却下"}されました`,
		body: params.formTitle,
	};
}
