import { textToHtml } from "./textToHtml";

export function projectRegistrationFormAuthorizationRequestedTemplate(params: {
	requesterName: string;
	formTitle: string;
	url: string;
}) {
	const body = `${params.requesterName} さんから企画登録フォームの承認申請が届きました。

フォームタイトル: ${params.formTitle}

以下のURLから承認または却下を行ってください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】企画登録フォーム承認の申請",
		html: textToHtml(body),
		text: body,
	};
}
