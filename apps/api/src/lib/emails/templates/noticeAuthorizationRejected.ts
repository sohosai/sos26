import { textToHtml } from "./textToHtml";

export function noticeAuthorizationRejectedTemplate(params: {
	noticeTitle: string;
	url: string;
}) {
	const body = `お知らせの承認依頼が却下されました。

タイトル: ${params.noticeTitle}

内容を修正のうえ、再度申請してください。

以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】お知らせの承認依頼が却下されました",
		html: textToHtml(body),
		text: body,
	};
}
