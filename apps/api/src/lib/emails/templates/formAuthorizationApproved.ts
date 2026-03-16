import { textToHtml } from "./textToHtml";

export function formAuthorizationApprovedTemplate(params: {
	formTitle: string;
	scheduledSendAt: string;
	url: string;
}) {
	const body = `フォームの配信承認が承認されました。

フォームタイトル: ${params.formTitle}
配信予定日時: ${params.scheduledSendAt}

詳細は以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】フォーム配信承認が承認されました",
		html: textToHtml(body),
		text: body,
	};
}
