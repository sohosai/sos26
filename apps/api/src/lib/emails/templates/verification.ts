export function verificationTemplate(params: { verifyUrl: string }) {
	return {
		subject: "メールアドレスの確認",
		html: `
      <p>以下のリンクをクリックして、メールアドレスを確認してください。</p>
      <p><a href="${params.verifyUrl}">確認する</a></p>
    `,
		text: `以下のURLを開いてメールアドレスを確認してください。\n${params.verifyUrl}`,
	};
}
