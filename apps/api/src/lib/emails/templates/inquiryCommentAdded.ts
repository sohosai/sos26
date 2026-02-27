export function inquiryCommentAddedTemplate(params: {
	inquiryTitle: string;
	commenterName: string;
	commentBodyPreview: string;
	url: string;
}) {
	const body = `お問い合わせに新しいコメントが追加されました。

タイトル: ${params.inquiryTitle}
コメント者: ${params.commenterName}

${params.commentBodyPreview}

以下のURLから詳細を確認してください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject:
			"【雙峰祭オンラインシステム】お問い合わせにコメントが追加されました",
		html: body.replace(/\n/g, "<br />"),
		text: body,
	};
}
