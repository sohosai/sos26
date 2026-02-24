export function noticeDeliveredTemplate(params: {
	noticeTitle: string;
	noticeBodyPreview: string;
	url: string;
}) {
	const body = `企画宛にお知らせが配信されました。

タイトル: ${params.noticeTitle}

${params.noticeBodyPreview}

詳細は以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: `【雙峰祭オンラインシステム】${params.noticeTitle}`,
		html: body.replace(/\n/g, "<br />"),
		text: body,
	};
}
