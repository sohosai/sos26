import { Heading, Text } from "@radix-ui/themes";
import { ErrorCode } from "@sos26/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Button, TextField } from "@/components/primitives";
import { register } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { isClientError } from "@/lib/http/error";
import styles from "../../auth.module.scss";

export const Route = createFileRoute("/auth/register/setup/")({
	component: SetupPage,
	head: () => ({
		meta: [
			{ title: "アカウント設定 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "名前とパスワードを設定してください" },
		],
	}),
});

function SetupPage() {
	const navigate = useNavigate();
	const { refreshUser } = useAuth();

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const validate = (
		password: string,
		passwordConfirm: string
	): string | null => {
		if (password !== passwordConfirm) return "パスワードが一致しません";
		if (password.length < 8) return "パスワードは8文字以上で入力してください";
		return null;
	};

	const getErrorMessage = (err: unknown): string => {
		console.error(err);
		if (isClientError(err)) {
			switch (err.code) {
				case ErrorCode.TOKEN_INVALID:
					return "セッションが期限切れです。最初から登録をやり直してください。";
				case ErrorCode.ALREADY_EXISTS:
					return "このメールアドレスは既に登録されています。ログインしてください。";
				case ErrorCode.VALIDATION_ERROR:
					return "入力内容に問題があります。確認してください。";
				default:
					return err.message;
			}
		}
		return "エラーが発生しました";
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const validationMessage = validate(password, passwordConfirm);
		if (validationMessage) {
			setError(validationMessage);
			return;
		}

		setLoading(true);

		try {
			const result = await register({
				firstName,
				lastName,
				password,
			});

			// 登録成功後、Firebase にログイン
			await signInWithEmailAndPassword(auth, result.user.email, password);

			// AuthContext のユーザー情報を更新
			await refreshUser();

			// ホームページへ遷移
			navigate({ to: "/" });
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles.container}>
			<header className={styles.header}>
				<Heading size="6">アカウント設定</Heading>
				<Text size="2" color="gray">
					名前とパスワードを設定してください
				</Text>
			</header>

			<form className={styles.form} onSubmit={handleSubmit}>
				<TextField
					label="姓"
					value={lastName}
					onChange={setLastName}
					required
					autoComplete="family-name"
				/>

				<TextField
					label="名"
					value={firstName}
					onChange={setFirstName}
					required
					autoComplete="given-name"
				/>

				<TextField
					label="パスワード"
					type="password"
					value={password}
					onChange={setPassword}
					required
					autoComplete="new-password"
				/>

				<TextField
					label="パスワード（確認）"
					type="password"
					value={passwordConfirm}
					onChange={setPasswordConfirm}
					required
					autoComplete="new-password"
				/>

				{error && (
					<Text size="2" color="red">
						{error}
					</Text>
				)}

				<Button type="submit" loading={loading} disabled={loading}>
					登録を完了する
				</Button>
			</form>

			<Text size="2" color="gray" className={styles.footer}>
				メール確認と同じブラウザで操作してください。
				<br />
				別のブラウザでは登録できません。
			</Text>
		</div>
	);
}
