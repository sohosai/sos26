import { textToHtml } from "./textToHtml";

export function formAuthorizationCancelledTemplate(params: {
	formTitle: string;
	url: string;
}) {
	const body = `申請の承認が取り消されました。

タイトル: ${params.formTitle}

申請の承認が承認者によって取り消されました。
必要に応じて、改めて申請を送信してください。

以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】申請の承認が取り消されました",
		html: textToHtml(body),
		text: body,
	};
}
