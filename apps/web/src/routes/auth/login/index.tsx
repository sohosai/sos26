import { Heading, Link as RadixLink, Text } from "@radix-ui/themes";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button, TextField } from "@/components/primitives";
import { sanitizeReturnTo, useAuthStore } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { isFirebaseError, mapFirebaseAuthError } from "@/lib/firebaseError";
import styles from "../auth.module.scss";

const searchSchema = z.object({
	returnTo: z.string().optional(),
});

export const Route = createFileRoute("/auth/login/")({
	validateSearch: searchSchema,
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
	const { returnTo } = Route.useSearch();
	const { isLoggedIn } = useAuthStore();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// ログイン後のリダイレクト先（バリデーション済み）
	const redirectTo = sanitizeReturnTo(returnTo);

	// ログイン成功後に returnTo へリダイレクト
	// （beforeLoad は "/" へリダイレクトするため、returnTo 対応はここで行う）
	useEffect(() => {
		if (isLoggedIn) {
			navigate({ to: redirectTo });
		}
	}, [isLoggedIn, navigate, redirectTo]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			await signInWithEmailAndPassword(auth, email, password);
			// リダイレクトは useEffect で isLoggedIn に応じて行う
		} catch (err) {
			if (isFirebaseError(err)) {
				setError(mapFirebaseAuthError(err));
			} else if (err instanceof Error) {
				setError("ログインに失敗しました");
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
				<RadixLink asChild>
					<Link to="/auth/reset-password">パスワードをお忘れの場合</Link>
				</RadixLink>
			</Text>

			<Text size="2" color="gray" className={styles.footer}>
				アカウントをお持ちでない場合は{" "}
				<RadixLink asChild>
					<Link to="/auth/register">新規登録</Link>
				</RadixLink>
			</Text>
		</div>
	);
}
