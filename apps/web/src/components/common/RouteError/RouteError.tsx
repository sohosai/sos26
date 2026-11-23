import { Heading, Text } from "@radix-ui/themes";
import * as Sentry from "@sentry/react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/primitives";
import styles from "./RouteError.module.scss";

/** ルートの errorComponent で出すエラー表示 */
export function RouteError({ error }: { error: unknown }) {
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
