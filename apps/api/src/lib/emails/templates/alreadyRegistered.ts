export function alreadyRegisteredTemplate(params: { loginUrl: string }) {
	const body = `このメールアドレスは既にアカウント登録済みです。
以下のURLからログインしてください。
${params.loginUrl}

※ このメールに心当たりがない場合は、このまま破棄してください。

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】アカウント登録のご案内",
		html: body.replace(/\n/g, "<br />"),
		text: body,
	};
}
