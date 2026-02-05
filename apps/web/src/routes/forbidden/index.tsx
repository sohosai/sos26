import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/primitives";
import styles from "../errorLayout.module.scss";

export const Route = createFileRoute("/forbidden/")({
	component: ForbiddenPage,
	head: () => ({
		meta: [
			{ title: "アクセス権限がありません | 雙峰祭オンラインシステム" },
			{
				name: "description",
				content: "このページへのアクセス権限がありません",
			},
		],
	}),
});

function ForbiddenPage() {
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
