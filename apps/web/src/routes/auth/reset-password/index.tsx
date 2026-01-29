import { Heading, Link as RadixLink, Text } from "@radix-ui/themes";
import { isTsukubaEmail } from "@sos26/shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { useEffect, useState } from "react";
import { Button, TextField } from "@/components/primitives";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { isFirebaseError } from "@/lib/firebaseError";
import styles from "../auth.module.scss";

export const Route = createFileRoute("/auth/reset-password/")({
	component: ResetPasswordPage,
	head: () => ({
		meta: [
			{ title: "パスワードリセット | 雙峰祭オンラインシステム" },
			{
				name: "description",
				content: "パスワードをリセットするためのメールを送信します",
			},
		],
	}),
});

function ResetPasswordPage() {
	const navigate = useNavigate();
	const { isLoggedIn, initialized } = useAuth();
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);

	useEffect(() => {
		if (isLoggedIn) {
			navigate({ to: "/" });
		}
	}, [isLoggedIn, navigate]);

	if (!initialized) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!isTsukubaEmail(email)) {
			setError(
				"筑波大学のメールアドレス（s0000000@u.tsukuba.ac.jp）を入力してください"
			);
			return;
		}

		setLoading(true);

		try {
			await sendPasswordResetEmail(auth, email, {
				url: `${window.location.origin}/auth/login`,
			});
			setSent(true);
		} catch (err) {
			if (isFirebaseError(err)) {
				switch (err.code) {
					// ユーザー列挙攻撃対策: 存在しないユーザーでも送信済み画面を表示
					case "auth/user-not-found":
						setSent(true);
						break;
					case "auth/too-many-requests":
						setError(
							"リクエストが多すぎます。しばらく待ってから再試行してください"
						);
						break;
					case "auth/network-request-failed":
						setError("ネットワークエラーが発生しました");
						break;
					case "auth/invalid-email":
						setError("メールアドレスの形式が正しくありません");
						break;
					default:
						setError("エラーが発生しました。もう一度お試しください");
						break;
				}
			} else {
				setError("エラーが発生しました。もう一度お試しください");
			}
		} finally {
			setLoading(false);
		}
	};

	if (sent) {
		return (
			<div className={styles.container}>
				<header className={styles.header}>
					<Heading size="6">メールを送信しました</Heading>
					<Text size="2" color="gray">
						{email} にパスワードリセット用のメールを送信しました。
						<br />
						メール内のリンクからパスワードを再設定してください。
					</Text>
				</header>

				<Text size="2" color="gray" className={styles.footer}>
					メールが届かない場合は、迷惑メールフォルダを確認するか、
					<RadixLink
						href="#"
						onClick={e => {
							e.preventDefault();
							setSent(false);
						}}
					>
						再送信
					</RadixLink>
					してください。
				</Text>

				<Text size="2" color="gray" className={styles.footer}>
					<RadixLink asChild>
						<Link to="/auth/login">ログインに戻る</Link>
					</RadixLink>
				</Text>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<header className={styles.header}>
				<Heading size="6">パスワードリセット</Heading>
				<Text size="2" color="gray">
					登録済みのメールアドレスを入力してください
				</Text>
			</header>

			<form className={styles.form} onSubmit={handleSubmit}>
				<TextField
					label="メールアドレス"
					type="email"
					placeholder="s0000000@u.tsukuba.ac.jp"
					value={email}
					onChange={setEmail}
					required
					autoComplete="email"
					error={error ?? undefined}
				/>

				<Button type="submit" loading={loading} disabled={loading}>
					リセットメールを送信
				</Button>
			</form>

			<Text size="2" color="gray" className={styles.footer}>
				<RadixLink asChild>
					<Link to="/auth/login">ログインに戻る</Link>
				</RadixLink>
			</Text>
		</div>
	);
}
