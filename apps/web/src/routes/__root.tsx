import { Heading, Text } from "@radix-ui/themes";
import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Button } from "@/components/primitives";
import { authReady } from "@/lib/auth";
import styles from "./errorLayout.module.scss";

export const Route = createRootRoute({
	beforeLoad: () => authReady(),
	component: RootComponent,
	errorComponent: ErrorComponent,
	notFoundComponent: NotFoundComponent,
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<Outlet />
			{import.meta.env.DEV && <TanStackRouterDevtools />}
		</>
	);
}

function NotFoundComponent() {
	return (
		<div className={styles.container}>
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
		<div className={styles.container}>
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
