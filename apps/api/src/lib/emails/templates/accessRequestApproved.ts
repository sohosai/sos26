import { textToHtml } from "./textToHtml";

export function accessRequestApprovedTemplate(params: {
	columnName: string;
	url: string;
}) {
	const body = `カラム「${params.columnName}」へのアクセス申請が承認されました。

マスターシートでカラムを表示できるようになりました。

以下のURLからご確認ください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject:
			"【雙峰祭オンラインシステム】カラムへのアクセス申請が承認されました",
		html: textToHtml(body),
		text: body,
	};
}
