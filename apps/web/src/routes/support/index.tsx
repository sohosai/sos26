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

			<Card className={styles.card}>
				<Heading size="4">報告例</Heading>
				<pre className={styles.example}>
					{`件名: SOS 不具合報告

発生画面:
申請 > 企画書提出

操作手順:
1. 申請一覧から「企画書提出」を開く
2. 「下書き保存」を押す
3. 画面右下にエラーが表示される

期待した結果:
下書きが保存される

実際の結果:
「保存に失敗しました」と表示される

発生頻度:
毎回

発生時刻:
2026/03/17 16:05ごろ

添付:
エラー画面のスクリーンショット 1枚`}
				</pre>
			</Card>
		</div>
	);
}
