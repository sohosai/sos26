import { Heading, Text } from "@radix-ui/themes";
import { type ErrorComponentProps, Link } from "@tanstack/react-router";
import { Button } from "@/components/primitives";
import { ForbiddenError } from "@/lib/auth";
import styles from "./forbidden-content.module.scss";

export function ForbiddenContent() {
	return (
		<div className={styles.container}>
			<Heading size="8" color="red">
				403
			</Heading>
			<Heading size="5">アクセス権限がありません</Heading>
			<Text color="gray">
				このページを表示する権限がないか、アカウントが無効化されています。
			</Text>
			<div className={styles.actions}>
				<Link to="/">
					<Button>ホームに戻る</Button>
				</Link>
			</div>
		</div>
	);
}

/**
 * TanStack Router の errorComponent として使用する
 * ForbiddenError の場合は 403 画面を表示し、それ以外は再 throw する
 */
export function ForbiddenErrorBoundary({ error }: ErrorComponentProps) {
	if (error instanceof ForbiddenError) {
		return <ForbiddenContent />;
	}
	throw error;
}
