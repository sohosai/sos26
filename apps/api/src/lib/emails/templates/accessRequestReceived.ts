export function accessRequestReceivedTemplate(params: {
	requesterName: string;
	columnName: string;
	url: string;
}) {
	const body = `${params.requesterName} さんからカラム「${params.columnName}」へのアクセス申請が届きました。

以下のURLからマスターシートを開き、承認または却下を行ってください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】カラムへのアクセス申請",
		html: body.replace(/\n/g, "<br />"),
		text: body,
	};
}
