import { textToHtml } from "./textToHtml";

export function projectRegistrationFormAuthorizationApprovedTemplate(params: {
	formTitle: string;
	url: string;
}) {
	const body = `企画登録フォームの承認申請が承認されました。

フォームタイトル: ${params.formTitle}

詳細は以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject:
			"【雙峰祭オンラインシステム】企画登録フォーム承認申請が承認されました",
		html: textToHtml(body),
		text: body,
	};
}
