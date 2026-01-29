import { FirebaseError } from "firebase/app";

/** FirebaseError かどうかの型ガード */
export function isFirebaseError(err: unknown): err is FirebaseError {
	return err instanceof FirebaseError;
}

/**
 * Firebase Auth のエラーコードを日本語のユーザ向けメッセージに変換
 * https://firebase.google.com/docs/auth/admin/errors?hl=ja を参考
 */
export function mapFirebaseAuthError(err: FirebaseError): string {
	switch (err.code) {
		case "auth/invalid-email":
			return "メールアドレスの形式が正しくありません";
		case "auth/user-disabled":
			return "このアカウントは無効化されています";
		case "auth/user-not-found":
		case "auth/wrong-password":
		case "auth/invalid-credential":
			return "メールアドレスまたはパスワードが正しくありません";
		case "auth/too-many-requests":
			return "ログイン試行回数が多すぎます。しばらく待ってから再試行してください";
		case "auth/network-request-failed":
			return "ネットワークエラーが発生しました";
		default:
			return "ログインに失敗しました";
	}
}
