import { textToHtml } from "./textToHtml";

export function formAuthorizationRejectedTemplate(params: {
	formTitle: string;
	url: string;
}) {
	const body = `申請の承認依頼が却下されました。

タイトル: ${params.formTitle}

内容を修正のうえ、再度申請してください。

以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】申請の承認依頼が却下されました",
		html: textToHtml(body),
		text: body,
	};
}
