import type { CommitteeMember, User } from "@sos26/shared";
import { ErrorCode } from "@sos26/shared";
import type { User as FirebaseUser } from "firebase/auth";
import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { create } from "zustand";
import { getMe } from "../api/auth";
import { auth as firebaseAuth } from "../firebase";
import { isClientError } from "../http/error";

type AuthStore = {
	user: User | null;
	committeeMember: CommitteeMember | null;
	firebaseUser: FirebaseUser | null;
	isLoading: boolean;
	isLoggedIn: boolean;
	isCommitteeMember: boolean;
	isFirebaseAuthenticated: boolean;
	signOut: () => Promise<void>;
	refreshUser: () => Promise<void>;
};

const UNAUTHENTICATED_STATE = {
	user: null,
	committeeMember: null,
	isLoggedIn: false,
	isCommitteeMember: false,
} as const;

export const useAuthStore = create<AuthStore>((set, get) => ({
	...UNAUTHENTICATED_STATE,
	firebaseUser: null,
	isLoading: false,
	isFirebaseAuthenticated: false,

	signOut: async () => {
		await firebaseSignOut(firebaseAuth);
		set(UNAUTHENTICATED_STATE);
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
		useAuthStore.setState(UNAUTHENTICATED_STATE);
		return;
	}

	useAuthStore.setState({ isLoading: true });
	try {
		const response = await getMe();
		useAuthStore.setState({
			user: response.user,
			committeeMember: response.committeeMember,
			isLoggedIn: true,
			isCommitteeMember: !!response.committeeMember,
		});
	} catch (err) {
		if (isClientError(err) && err.code === ErrorCode.NOT_FOUND) {
			useAuthStore.setState(UNAUTHENTICATED_STATE);
		} else {
			console.error("[AuthStore] getMe failed", err);
			useAuthStore.setState(UNAUTHENTICATED_STATE);
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
