import { Heading, Text } from "@radix-ui/themes";
import { ErrorCode } from "@sos26/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/primitives";
import { verifyEmail } from "@/lib/api/auth";
import { isClientError } from "@/lib/http/error";
import styles from "../../auth.module.scss";

export const Route = createFileRoute("/auth/register/verify/")({
	component: VerifyPage,
	head: () => ({
		meta: [
			{ title: "メールアドレスの確認 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "メールアドレスを確認してください" },
		],
	}),
});

function VerifyPage() {
	const navigate = useNavigate();
	const [token, setToken] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// URL のハッシュからトークンを取得
	useEffect(() => {
		const hash = window.location.hash;
		if (hash && hash.length > 1) {
			setToken(hash.slice(1));
		}
	}, []);

	const handleVerify = async () => {
		if (!token) return;

		setError(null);
		setLoading(true);

		try {
			await verifyEmail({ token });
			navigate({ to: "/auth/register/setup" });
		} catch (err) {
			if (isClientError(err)) {
				if (err.code === ErrorCode.TOKEN_INVALID) {
					setError(
						"リンクが無効または期限切れです。再度登録をお試しください。"
					);
				} else {
					setError(err.message);
				}
			} else {
				setError("エラーが発生しました");
			}
		} finally {
			setLoading(false);
		}
	};

	if (!token) {
		return (
			<div className={styles.container}>
				<header className={styles.header}>
					<Heading size="6">無効なリンク</Heading>
					<Text size="2" color="gray">
						このリンクは無効です。メール内のリンクを再度クリックしてください。
					</Text>
				</header>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<header className={styles.header}>
				<Heading size="6">メールアドレスの確認</Heading>
				<Text size="2" color="gray">
					下のボタンをクリックして、メールアドレスを確認してください。
				</Text>
			</header>

			{error && (
				<Text size="2" color="red">
					{error}
				</Text>
			)}

			<div className={styles.form}>
				<Button onClick={handleVerify} loading={loading} disabled={loading}>
					メールアドレスを確認
				</Button>
			</div>

			<Text size="2" color="gray" className={styles.footer}>
				このボタンは、メールを受け取ったブラウザで押してください。
				<br />
				確認後、同じブラウザでパスワード設定に進みます。
			</Text>
		</div>
	);
}
