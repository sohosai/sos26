export function subOwnerRequestRejectedTemplate(params: {
	userName: string;
	projectName: string;
}) {
	const body = `${params.userName} さんが副責任者リクエストを辞退しました。

企画名: ${params.projectName}

別のメンバーを副責任者に指名してください。

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】副責任者リクエストが辞退されました",
		html: body.replace(/\n/g, "<br />"),
		text: body,
	};
}
