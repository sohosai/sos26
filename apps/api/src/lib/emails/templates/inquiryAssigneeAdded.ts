export function inquiryAssigneeAddedTemplate(params: {
	inquiryTitle: string;
	url: string;
}) {
	const body = `お問い合わせの担当者に追加されました。

タイトル: ${params.inquiryTitle}

以下のURLから内容を確認してください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】お問い合わせの担当者に追加されました",
		html: body.replace(/\n/g, "<br />"),
		text: body,
	};
}
