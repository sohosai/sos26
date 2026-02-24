export function inquiryCreatedForProjectTemplate(params: {
	creatorName: string;
	inquiryTitle: string;
	url: string;
}) {
	const body = `実行委員会からお問い合わせが作成されました。

作成者: ${params.creatorName}
タイトル: ${params.inquiryTitle}

以下のURLから内容を確認してください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】実行委員会からのお問い合わせ",
		html: body.replace(/\n/g, "<br />"),
		text: body,
	};
}
