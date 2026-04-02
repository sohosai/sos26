import { Dialog, Heading, Text, Theme } from "@radix-ui/themes";
import * as Sentry from "@sentry/react";
import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { useEffect, useState } from "react";
import { Button } from "@/components/primitives";
import { enablePush } from "@/lib/api/push";
import { authReady } from "@/lib/auth";
import {
	getPromptedFlag,
	getPushEnabledPreference,
	isPushSupported,
	setPromptedFlag,
	setPushEnabledPreference,
	setSubscribedFlag,
} from "@/lib/push";
import styles from "./__root.module.scss";

export const Route = createRootRoute({
	beforeLoad: () => authReady(),
	component: RootComponent,
	errorComponent: ErrorComponent,
	notFoundComponent: NotFoundComponent,
});

function RootComponent() {
	const location = useLocation();
	const [showPushOpen, setShowPushBanner] = useState(false);
	useEffect(() => {
		if (
			isPushSupported() &&
			getPushEnabledPreference() &&
			Notification.permission === "default" &&
			!getPromptedFlag()
		) {
			setShowPushBanner(true);
		}
	}, []);

	const handlePushAllow = async () => {
		setShowPushBanner(false);
		setPromptedFlag(true);
		const permission = await Notification.requestPermission();
		if (permission === "granted") {
			await enablePush();
			setSubscribedFlag(true);
		} else if (permission === "denied") {
			setPushEnabledPreference(false);
		}
	};

	const handlePushDismiss = () => {
		setShowPushBanner(false);
		setPromptedFlag(true);
	};

	const getAccentColor = (path: string) => {
		if (path.startsWith("/project")) return "blue";
		if (path.startsWith("/committee")) return "orange";
		return "indigo";
	};

	const accentColor = getAccentColor(location.pathname);

	return (
		<Theme accentColor={accentColor} grayColor="slate" panelBackground="solid">
			<HeadContent />
			<div className={styles.appLayout}>
				<Outlet />
			</div>
			{showPushOpen && (
				<PushDialog
					open={showPushOpen}
					onAllow={handlePushAllow}
					onDismiss={handlePushDismiss}
				/>
			)}
			{import.meta.env.DEV && <TanStackRouterDevtools />}
		</Theme>
	);
}

function NotFoundComponent() {
	return (
		<div className={styles.errorContainer}>
			<Heading size="8" color="gray">
				404
			</Heading>
			<Heading size="5">ページが見つかりません</Heading>
			<Text color="gray">
				お探しのページは存在しないか、移動した可能性があります。
			</Text>
			<div className={styles.actions}>
				<Link to="/">
					<Button>ホームに戻る</Button>
				</Link>
			</div>
		</div>
	);
}

function ErrorComponent({ error }: { error: unknown }) {
	const message =
		error instanceof Error ? error.message : String(error ?? "Unknown error");

	useEffect(() => {
		console.error("[Route Error]", error);
		Sentry.captureException(error);
	}, [error]);

	return (
		<div className={styles.errorContainer}>
			<Heading size="8" color="red">
				Error
			</Heading>
			<Heading size="5">エラーが発生しました</Heading>
			<Text color="gray">{message}</Text>
			<div className={styles.actions}>
				<Link to="/">
					<Button>ホームに戻る</Button>
				</Link>
			</div>
		</div>
	);
}

function PushDialog({
	open,
	onAllow,
	onDismiss,
}: {
	open: boolean;
	onAllow: () => void;
	onDismiss: () => void;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={v => !v && onDismiss()}>
			<Dialog.Content className={styles.dialogContent}>
				<Dialog.Title className={styles.dialogTitle}>通知の許可</Dialog.Title>
				<Dialog.Description className={styles.dialogDescription}>
					お知らせ・申請等の新着情報をプッシュ通知でお知らせします。
				</Dialog.Description>

				<div className={styles.dialogActions}>
					<Button onClick={onDismiss}>後で</Button>
					<Button onClick={onAllow}>許可する</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
