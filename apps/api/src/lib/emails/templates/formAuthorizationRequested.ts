import { textToHtml } from "./textToHtml";

export function formAuthorizationRequestedTemplate(params: {
	requesterName: string;
	formTitle: string;
	scheduledSendAt: string;
	url: string;
}) {
	const body = `${params.requesterName} さんから申請の承認依頼が申請されました。

タイトル: ${params.formTitle}
配信希望日時: ${params.scheduledSendAt}

以下のURLから承認または却下を行ってください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】申請の承認依頼が申請されました",
		html: textToHtml(body),
		text: body,
	};
}
