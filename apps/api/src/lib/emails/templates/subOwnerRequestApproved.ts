export function subOwnerRequestApprovedTemplate(params: {
	userName: string;
	projectName: string;
}) {
	const body = `${params.userName} さんが副責任者リクエストを承認しました。

企画名: ${params.projectName}

${params.userName} さんが副責任者に任命されました。

------------------------------------------------------------------------
筑波大学学園祭実行委員会 雙峰祭オンラインシステム
このメールは送信専用です。返信いただいてもお応えできません。`;

	return {
		subject: "【雙峰祭オンラインシステム】副責任者リクエストが承認されました",
		html: body.replace(/\n/g, "<br />"),
		text: body,
	};
}
