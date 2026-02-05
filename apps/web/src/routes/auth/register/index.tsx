import { Heading, Link as RadixLink, Text } from "@radix-ui/themes";
import { ErrorCode, isTsukubaEmail } from "@sos26/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, TextField } from "@/components/primitives";
import { startEmailVerification } from "@/lib/api/auth";
import { isClientError } from "@/lib/http/error";
import styles from "../auth.module.scss";

export const Route = createFileRoute("/auth/register/")({
	component: RegisterPage,
	head: () => ({
		meta: [
			{ title: "新規登録 | 雙峰祭オンラインシステム" },
			{
				name: "description",
				content: "筑波大学のメールアドレスで新規登録してください",
			},
		],
	}),
});

function RegisterPage() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		// UI側バリデーション
		if (!isTsukubaEmail(email)) {
			setError(
				"筑波大学のメールアドレス（s0000000@u.tsukuba.ac.jp）を入力してください"
			);
			return;
		}

		setLoading(true);

		try {
			await startEmailVerification({ email });
			setSent(true);
		} catch (err) {
			if (isClientError(err)) {
				if (err.code === ErrorCode.VALIDATION_ERROR) {
					setError(
						"筑波大学のメールアドレス（s0000000@u.tsukuba.ac.jp）を入力してください"
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

	if (sent) {
		return (
			<div className={styles.container}>
				<header className={styles.header}>
					<Heading size="6">メールを送信しました</Heading>
					<Text size="2" color="gray">
						{email} に確認メールを送信しました。
						<br />
						メール内のリンクをクリックして、登録を続けてください。
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
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<header className={styles.header}>
				<Heading size="6">新規登録</Heading>
				<Text size="2" color="gray">
					筑波大学のメールアドレスを入力してください
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
					確認メールを送信
				</Button>
			</form>

			<Text size="2" color="gray" className={styles.footer}>
				既にアカウントをお持ちの場合は{" "}
				<RadixLink asChild>
					<Link to="/auth/login">ログイン</Link>
				</RadixLink>
			</Text>
		</div>
	);
}
