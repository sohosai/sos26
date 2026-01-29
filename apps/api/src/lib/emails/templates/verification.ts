export function verificationTemplate(params: { verifyUrl: string }) {
	return {
		subject: "メールアドレスの確認",
		html: `
      <p>以下のリンクをクリックして、メールアドレスを確認してください。</p>
      <p><a href="${params.verifyUrl}">確認する</a></p>
      <hr />
      <p style="color:#555;font-size:0.95em;">リンクが開けない場合は、次のURLをブラウザにコピー＆ペーストしてください。</p>
      <p style="word-break:break-all;">${params.verifyUrl}</p>
    `,
		text: `以下のURLを開いてメールアドレスを確認してください。\n${params.verifyUrl}\n\nリンクが開けない場合は、上記URLをブラウザにコピー＆ペーストしてください。`,
	};
}
