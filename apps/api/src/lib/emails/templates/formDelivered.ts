import { textToHtml } from "./textToHtml";

export function formDeliveredTemplate(params: {
	formTitle: string;
	url: string;
}) {
	const body = `企画宛に申請が配信されました。

申請名: ${params.formTitle}

詳細は以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: `【雙峰祭オンラインシステム】${params.formTitle}`,
		html: textToHtml(body),
		text: body,
	};
}
