import { Heading, Link as RadixLink, Text } from "@radix-ui/themes";
import {
	ErrorCode,
	namePhoneticSchema,
	nameSchema,
	passwordSchema,
	telephoneNumberSchema,
} from "@sos26/shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { toast } from "sonner";
import FilePreviewDialog from "@/components/filePreview/FilePreviewDialog";
import { Button, Checkbox, TextField } from "@/components/primitives";
import { register } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
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
	const { refreshUser } = useAuthStore();

	const [name, setName] = useState("");
	const [namePhonetic, setNamePhonetic] = useState("");
	const [telephoneNumber, setTelephoneNumber] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [termsAccepted, setTermsAccepted] = useState(false);
	const [termsFile, setTermsFile] = useState<File | null>(null);
	const [termsDialogOpen, setTermsDialogOpen] = useState(false);
	const [termsLoading, setTermsLoading] = useState(false);
	const [loading, setLoading] = useState(false);
	const [sessionExpired, setSessionExpired] = useState(false);
	const termsFilePath = "/雙峰祭オンラインシステム利用規約.pdf";
	const termsFileName = "雙峰祭オンラインシステム利用規約.pdf";

	const handleOpenTerms = async () => {
		if (termsFile) {
			setTermsDialogOpen(true);
			return;
		}

		setTermsLoading(true);
		try {
			const response = await fetch(termsFilePath);
			if (!response.ok) throw new Error("failed to fetch terms");
			const blob = await response.blob();
			const file = new File([blob], termsFileName, {
				type: blob.type || "application/pdf",
			});
			setTermsFile(file);
			setTermsDialogOpen(true);
		} catch {
			toast.error("利用規約の読み込みに失敗しました");
		} finally {
			setTermsLoading(false);
		}
	};

	const handleDownloadTerms = () => {
		const link = document.createElement("a");
		link.href = termsFilePath;
		link.download = termsFileName;
		link.click();
	};

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: 各フィールドのバリデーションを順次チェックしているだけで実質的に複雑ではない
	const validate = (): string | null => {
		const nameResult = nameSchema.safeParse(name);
		if (!nameResult.success) {
			return nameResult.error.issues[0]?.message ?? "名前を入力してください";
		}

		const namePhoneticResult = namePhoneticSchema.safeParse(namePhonetic);
		if (!namePhoneticResult.success) {
			return (
				namePhoneticResult.error.issues[0]?.message ??
				"名前（ふりがな）を入力してください"
			);
		}

		const telephoneNumberResult =
			telephoneNumberSchema.safeParse(telephoneNumber);
		if (!telephoneNumberResult.success) {
			return (
				telephoneNumberResult.error.issues[0]?.message ??
				"電話番号を入力してください"
			);
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

		if (!termsAccepted) return "利用規約に同意してください";

		return null;
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
				name,
				namePhonetic,
				telephoneNumber,
				password,
			});

			// 登録成功後、Firebase にログイン
			await signInWithEmailAndPassword(auth, result.user.email, password);

			// ストアのユーザー情報を更新
			await refreshUser();

			// ホームページへ遷移
			navigate({ to: "/" });
		} catch (err) {
			if (isClientError(err) && err.code === ErrorCode.TOKEN_INVALID) {
				setSessionExpired(true);
			}
			reportHandledError({
				error: err,
				operation: "create",
				userMessage: "エラーが発生しました",
				ui: { type: "inline", setError },
				resolveMessage: ({ error, fallbackMessage }) => {
					if (isClientError(error)) {
						switch (error.code) {
							case ErrorCode.TOKEN_INVALID:
								return "セッションが期限切れです。最初から登録をやり直してください。";
							case ErrorCode.ALREADY_EXISTS:
								return "このメールアドレスは既に登録されています。ログインしてください。";
							case ErrorCode.VALIDATION_ERROR:
								return "入力内容に問題があります。確認してください。";
							default:
								return error.message;
						}
					}

					if (isFirebaseError(error)) {
						return mapFirebaseAuthError(error);
					}

					return fallbackMessage;
				},
				context: {
					flow: "auth_register_setup",
				},
			});
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
					label="名前"
					value={name}
					onChange={setName}
					autoComplete="name"
				/>

				<TextField
					label="名前（ふりがな）"
					value={namePhonetic}
					onChange={setNamePhonetic}
				/>

				<TextField
					label="電話番号"
					type="tel"
					value={telephoneNumber}
					onChange={setTelephoneNumber}
					autoComplete="tel"
				/>

				<TextField
					label="パスワード"
					type="password"
					value={password}
					onChange={setPassword}
					autoComplete="new-password"
				/>

				<TextField
					label="パスワード（確認）"
					type="password"
					value={passwordConfirm}
					onChange={setPasswordConfirm}
					autoComplete="new-password"
				/>

				<Button
					intent="secondary"
					size="2"
					onClick={handleOpenTerms}
					loading={termsLoading}
				>
					利用規約を表示
				</Button>
				<FilePreviewDialog
					file={termsFile}
					open={termsDialogOpen}
					onOpenChange={setTermsDialogOpen}
					onDownload={handleDownloadTerms}
				/>
				<Checkbox
					label="利用規約に同意する"
					checked={termsAccepted}
					onCheckedChange={setTermsAccepted}
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
