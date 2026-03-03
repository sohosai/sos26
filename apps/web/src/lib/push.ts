import { toast } from "sonner";
import { disablePush, enablePush } from "./api/push";

// ユーザーがPushを有効にしているか
const PUSH_ENABLED_KEY = "sos26.push.enabled";
// すでにPush購読処理を行ったか
const PUSH_SUBSCRIBED_KEY = "sos26.push.subscribed";
// 通知許可ダイアログを一度でも表示したか
const PUSH_PROMPTED_KEY = "sos26.push.prompted";

export type PushPermissionResult = "granted" | "denied" | "dismissed";

export async function ensurePushPermission(): Promise<PushPermissionResult> {
	if (Notification.permission === "granted") return "granted";

	if (Notification.permission === "denied") return "denied";

	const permission = await Notification.requestPermission();
	setPromptedFlag(true);

	if (permission === "granted") return "granted";
	if (permission === "denied") return "denied";
	return "dismissed";
}

/**
 * Push通知対応ブラウザかどうかの事前チェック
 */
export function isPushSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		"Notification" in window &&
		"serviceWorker" in navigator
	);
}
export function getPushEnabledPreference(): boolean {
	if (typeof window === "undefined") return true;
	const value = window.localStorage.getItem(PUSH_ENABLED_KEY);
	return value !== "false";
}

export function setPushEnabledPreference(enabled: boolean): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(PUSH_ENABLED_KEY, String(enabled));
}

export function getSubscribedFlag(): boolean {
	if (typeof window === "undefined") return false;
	return window.localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "true";
}

export function setSubscribedFlag(subscribed: boolean): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(PUSH_SUBSCRIBED_KEY, String(subscribed));
}

export function getPromptedFlag(): boolean {
	if (typeof window === "undefined") return false;
	return window.localStorage.getItem(PUSH_PROMPTED_KEY) === "true";
}

export function setPromptedFlag(prompted: boolean): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(PUSH_PROMPTED_KEY, String(prompted));
}

export async function disablePushByPreference(): Promise<void> {
	setPushEnabledPreference(false);
	setSubscribedFlag(false);
	try {
		await disablePush();
	} catch {
		toast.error("Push通知の無効化に失敗しました");
	}
}

export async function enablePushByPreference(): Promise<boolean> {
	if (!isPushSupported()) {
		toast.error("このブラウザはPush通知に対応していません");
		return false;
	}

	try {
		setPushEnabledPreference(true);

		const permission = await ensurePushPermission();
		if (permission !== "granted") {
			if (permission === "denied") {
				setPushEnabledPreference(false);
				toast.error("通知が拒否されています");
			}
			return false;
		}

		if (!getSubscribedFlag()) {
			await enablePush();
			setSubscribedFlag(true);
		}
		toast.success("Push通知を有効化しました");
		return true;
	} catch {
		toast.error("Push通知の有効化に失敗しました");
		return false;
	}
}
