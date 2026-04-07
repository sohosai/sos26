import { textToHtml } from "./textToHtml";

export function subOwnerRequestSentTemplate(params: {
	ownerName: string;
	projectName: string;
	url: string;
}) {
	const body = `${params.ownerName} さんから副企画責任者リクエストが届きました。

企画名: ${params.projectName}

以下のURLからメンバー一覧を開いて、承認または辞退を行ってください。
${params.url}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】副企画責任者リクエスト",
		html: textToHtml(body),
		text: body,
	};
}
