export function noticeAuthorizationRequestedTemplate(params: {
	requesterName: string;
	noticeTitle: string;
	deliveredAt: string;
	url: string;
}) {
	const body = `${params.requesterName} さんからお知らせの配信承認が申請されました。

お知らせタイトル: ${params.noticeTitle}
配信希望日時: ${params.deliveredAt}

以下のURLから承認または却下を行ってください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】配信承認の申請",
		html: body.replace(/\n/g, "<br />"),
		text: body,
	};
}
