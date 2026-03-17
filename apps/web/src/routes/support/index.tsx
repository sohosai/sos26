import { Card, Heading, Link, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import styles from "./index.module.scss";

const SUPPORT_EMAIL = "info@sohosai.com";

export const Route = createFileRoute("/support/")({
	component: SupportPage,
	head: () => ({
		meta: [{ title: "不具合報告 | 雙峰祭オンラインシステム" }],
	}),
});

function SupportPage() {
	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<Heading size="6">不具合報告</Heading>
				<Text size="2" color="gray">
					不具合はメールでご連絡ください。確認後、順次対応します。
				</Text>
			</div>

			<Card className={styles.card}>
				<Heading size="4">報告先メールアドレス</Heading>
				<Text size="2" className={styles.mail}>
					<Link href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</Link>
				</Text>
			</Card>

			<Card className={styles.card}>
				<Heading size="4">報告方法</Heading>
				<ol className={styles.steps}>
					<li>件名を「SOS 不具合報告」にして送信してください。</li>
					<li>発生した画面名・操作手順・期待した結果を記載してください。</li>
					<li>
						表示されたエラーメッセージやスクリーンショットを添付してください。
					</li>
					<li>発生頻度（毎回/たまに）と発生時刻を記載してください。</li>
				</ol>
			</Card>
		</div>
	);
}
