import { Heading, Link as RadixLink, Text } from "@radix-ui/themes";
import {
	ErrorCode,
	firstNameSchema,
	lastNameSchema,
	passwordSchema,
} from "@sos26/shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useState } from "react";
import { Button, TextField } from "@/components/primitives";
import { register } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { isFirebaseError, mapFirebaseAuthError } from "@/lib/firebaseError";
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
	const { refreshUser, isLoggedIn } = useAuth();

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [sessionExpired, setSessionExpired] = useState(false);

	// 既にログイン済みならホームへ
	useEffect(() => {
		if (isLoggedIn) {
			navigate({ to: "/" });
		}
	}, [isLoggedIn, navigate]);

	const validate = (): string | null => {
		const lastNameResult = lastNameSchema.safeParse(lastName);
		if (!lastNameResult.success) {
			return lastNameResult.error.issues[0]?.message ?? "姓を入力してください";
		}

		const firstNameResult = firstNameSchema.safeParse(firstName);
		if (!firstNameResult.success) {
			return firstNameResult.error.issues[0]?.message ?? "名を入力してください";
		}

		const passwordResult = passwordSchema.safeParse(password);
		if (!passwordResult.success) {
			return (
				passwordResult.error.issues[0]?.message ??
				"パスワードは8文字以上で入力してください"
			);
		}

		if (password !== passwordConfirm) {
			return "パスワードが一致しません";
		}

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
		if (isFirebaseError(err)) {
			return mapFirebaseAuthError(err);
		}
		return "エラーが発生しました";
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const validationMessage = validate();
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
			if (isClientError(err) && err.code === ErrorCode.TOKEN_INVALID) {
				setSessionExpired(true);
			}
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
					<>
						<Text size="2" color="red">
							{error}
						</Text>
						{sessionExpired && (
							<Text size="2" color="gray">
								{" "}
								新規登録の最初のステップからやり直してください。
								<br />
								登録メールの送信は{" "}
								<RadixLink asChild>
									<Link to="/auth/register">こちら</Link>
								</RadixLink>{" "}
								から行えます。
							</Text>
						)}
					</>
				)}

				<Button
					type="submit"
					loading={loading}
					disabled={loading || sessionExpired}
				>
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
