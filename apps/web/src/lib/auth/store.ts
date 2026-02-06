import type { User } from "@sos26/shared";
import { ErrorCode } from "@sos26/shared";
import type { User as FirebaseUser } from "firebase/auth";
import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { create } from "zustand";
import { getMe } from "../api/auth";
import { auth as firebaseAuth } from "../firebase";
import { isClientError } from "../http/error";

type AuthStore = {
	user: User | null;
	firebaseUser: FirebaseUser | null;
	isLoading: boolean;
	isLoggedIn: boolean;
	isFirebaseAuthenticated: boolean;
	signOut: () => Promise<void>;
	refreshUser: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
	user: null,
	firebaseUser: null,
	isLoading: false,
	isLoggedIn: false,
	isFirebaseAuthenticated: false,

	signOut: async () => {
		await firebaseSignOut(firebaseAuth);
		set({ user: null, isLoggedIn: false });
	},

	refreshUser: async () => {
		const { firebaseUser } = get();
		if (!firebaseUser) return;
		await fetchAndSetUser(firebaseUser);
	},
}));

/**
 * Firebase ユーザーからバックエンドのユーザー情報を取得し、store を更新する
 */
async function fetchAndSetUser(fbUser: FirebaseUser | null): Promise<void> {
	useAuthStore.setState({
		firebaseUser: fbUser,
		isFirebaseAuthenticated: !!fbUser,
	});

	if (!fbUser) {
		useAuthStore.setState({ user: null, isLoggedIn: false });
		return;
	}

	useAuthStore.setState({ isLoading: true });
	try {
		const response = await getMe();
		useAuthStore.setState({ user: response.user, isLoggedIn: true });
	} catch (err) {
		if (isClientError(err) && err.code === ErrorCode.NOT_FOUND) {
			useAuthStore.setState({ user: null, isLoggedIn: false });
		} else {
			console.error("[AuthStore] getMe failed", err);
			useAuthStore.setState({ user: null, isLoggedIn: false });
		}
	} finally {
		useAuthStore.setState({ isLoading: false });
	}
}

/**
 * Firebase 認証状態の初回確定を待つ Promise を返す
 * 初回呼び出し時に onAuthStateChanged リスナーを遅延起動する
 */
let listenerStarted = false;
let resolveReady: () => void;
const readyPromise = new Promise<void>(r => {
	resolveReady = r;
});

export function authReady(): Promise<void> {
	if (!listenerStarted) {
		listenerStarted = true;
		let resolved = false;

		onAuthStateChanged(firebaseAuth, async fbUser => {
			await fetchAndSetUser(fbUser);

			if (!resolved) {
				resolved = true;
				resolveReady();
			}
		});
	}
	return readyPromise;
}
