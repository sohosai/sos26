import { textToHtml } from "./textToHtml";

export function noticeAuthorizationApprovedTemplate(params: {
	noticeTitle: string;
	deliveredAt: string;
	url: string;
}) {
	const body = `お知らせの承認依頼が承認されました。

タイトル: ${params.noticeTitle}
配信予定日時: ${params.deliveredAt}

詳細は以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】お知らせの承認依頼が承認されました",
		html: textToHtml(body),
		text: body,
	};
}
