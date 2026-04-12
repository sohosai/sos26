import { textToHtml } from "./textToHtml";

export function noticeAuthorizationCancelledTemplate(params: {
	noticeTitle: string;
	url: string;
}) {
	const body = `お知らせの承認が取り消されました。

タイトル: ${params.noticeTitle}

お知らせの承認が承認者によって取り消されました。
必要に応じて、改めてお知らせを公開申請してください。

以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】お知らせの承認が取り消されました",
		html: textToHtml(body),
		text: body,
	};
}
