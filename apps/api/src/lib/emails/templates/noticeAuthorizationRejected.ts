export function noticeAuthorizationRejectedTemplate(params: {
	noticeTitle: string;
	url: string;
}) {
	const body = `お知らせの配信承認が却下されました。

お知らせタイトル: ${params.noticeTitle}

内容を修正のうえ、再度申請してください。

以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】配信承認が却下されました",
		html: body.replace(/\n/g, "<br />"),
		text: body,
	};
}
