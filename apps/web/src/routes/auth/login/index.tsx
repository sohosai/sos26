import { Heading, Link as RadixLink, Text } from "@radix-ui/themes";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Button, TextField } from "@/components/primitives";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import styles from "../auth.module.scss";

export const Route = createFileRoute("/auth/login/")({
	component: LoginPage,
	head: () => ({
		meta: [
			{ title: "ログイン | 雙峰祭オンラインシステム" },
			{ name: "description", content: "アカウントにログインしてください" },
		],
	}),
});

function LoginPage() {
	const navigate = useNavigate();
	const { isLoggedIn } = useAuth();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// 既にログイン済みならリダイレクト
	if (isLoggedIn) {
		navigate({ to: "/" });
		return null;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			await signInWithEmailAndPassword(auth, email, password);
			navigate({ to: "/" });
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes("invalid-credential")) {
					setError("メールアドレスまたはパスワードが正しくありません");
				} else if (err.message.includes("too-many-requests")) {
					setError(
						"ログイン試行回数が多すぎます。しばらく待ってから再試行してください"
					);
				} else {
					setError("ログインに失敗しました");
				}
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles.container}>
			<header className={styles.header}>
				<Heading size="6">ログイン</Heading>
				<Text size="2" color="gray">
					アカウントにログインしてください
				</Text>
			</header>

			<form className={styles.form} onSubmit={handleSubmit}>
				<TextField
					label="メールアドレス"
					type="email"
					value={email}
					onChange={setEmail}
					required
					autoComplete="email"
				/>

				<TextField
					label="パスワード"
					type="password"
					value={password}
					onChange={setPassword}
					required
					autoComplete="current-password"
				/>

				{error && (
					<Text size="2" color="red">
						{error}
					</Text>
				)}

				<Button type="submit" loading={loading} disabled={loading}>
					ログイン
				</Button>
			</form>

			<Text size="2" color="gray" className={styles.footer}>
				アカウントをお持ちでない場合は{" "}
				<RadixLink asChild>
					<Link to="/auth/register">新規登録</Link>
				</RadixLink>
			</Text>
		</div>
	);
}
