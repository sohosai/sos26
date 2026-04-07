import { textToHtml } from "./textToHtml";

export function subOwnerRequestCancelledTemplate(params: {
	ownerName: string;
	projectName: string;
}) {
	const body = `${params.ownerName} さんが副企画責任者リクエストを取り消しました。

企画名: ${params.projectName}

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject:
			"【雙峰祭オンラインシステム】副企画責任者リクエストが取り消されました",
		html: textToHtml(body),
		text: body,
	};
}
