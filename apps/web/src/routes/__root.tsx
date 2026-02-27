import { Heading, Text, Theme } from "@radix-ui/themes";
import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Button } from "@/components/primitives";
import { authReady } from "@/lib/auth";
import styles from "./__root.module.scss";

export const Route = createRootRoute({
	beforeLoad: () => authReady(),
	component: RootComponent,
	errorComponent: ErrorComponent,
	notFoundComponent: NotFoundComponent,
});

function RootComponent() {
	const location = useLocation();

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
