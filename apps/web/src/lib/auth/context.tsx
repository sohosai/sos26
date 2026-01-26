import type { User } from "@sos26/shared";
import { ErrorCode } from "@sos26/shared";
import type { User as FirebaseUser } from "firebase/auth";
import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { getMe } from "../api/auth";
import { auth } from "../firebase";
import { isClientError } from "../http/error";

type AuthState = {
	/**
	 * ログイン中のユーザー（本登録完了済み）
	 * 末端ページはこれだけ見ればOK
	 */
	user: User | null;
	/** ログイン中か（本登録完了済み） */
	isLoggedIn: boolean;
	/** 認証状態の初期化が完了したか */
	initialized: boolean;
	/** 認証状態の読み込み中か */
	isLoading: boolean;
	/** ログアウト */
	signOut: () => Promise<void>;
	/** ユーザー情報を再取得 */
	refreshUser: () => Promise<void>;

	// 登録フロー用（通常のページでは使用しない）
	/** Firebase ユーザー（登録フロー用） */
	firebaseUser: FirebaseUser | null;
	/** Firebase認証済みか（登録フロー用） */
	isFirebaseAuthenticated: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

type AuthProviderProps = {
	children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
	const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [initialized, setInitialized] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	// DBユーザー情報を取得
	const fetchUser = useCallback(async () => {
		setIsLoading(true);
		try {
			const response = await getMe();
			setUser(response.user);
		} catch (err) {
			// 未登録ユーザーの場合のみ404（NOT_FOUND）を期待
			if (isClientError(err) && err.code === ErrorCode.NOT_FOUND) {
				setUser(null);
			} else {
				// それ以外はログに残してユーザーなしとして扱う
				console.error("[AuthContext] getMe failed", err);
				setUser(null);
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Firebase認証状態の監視
	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, async fbUser => {
			setFirebaseUser(fbUser);

			if (fbUser) {
				// Firebaseログイン中ならDBユーザーを取得
				await fetchUser();
			} else {
				// ログアウト時はDBユーザーもクリア
				setUser(null);
			}

			setInitialized(true);
		});

		return () => unsubscribe();
	}, [fetchUser]);

	const signOut = async () => {
		await firebaseSignOut(auth);
		setUser(null);
	};

	const refreshUser = async () => {
		if (firebaseUser) {
			await fetchUser();
		}
	};

	const value: AuthState = {
		// 末端ページ用（これだけ使えばOK）
		user,
		isLoggedIn: !!user,
		initialized,
		isLoading,
		signOut,
		refreshUser,

		// 登録フロー用
		firebaseUser,
		isFirebaseAuthenticated: !!firebaseUser,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
