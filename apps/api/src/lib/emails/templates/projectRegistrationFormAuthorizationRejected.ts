export function projectRegistrationFormAuthorizationRejectedTemplate(params: {
	formTitle: string;
	url: string;
}) {
	const body = `企画登録フォームの承認申請が却下されました。

フォームタイトル: ${params.formTitle}

内容を修正のうえ、再度申請してください。

以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject:
			"【雙峰祭オンラインシステム】企画登録フォーム承認申請が却下されました",
		html: body.replace(/\n/g, "<br />"),
		text: body,
	};
}
