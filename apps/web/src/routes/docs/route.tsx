import { Text } from "@radix-ui/themes";
import { IconFileText, IconMenu2 } from "@tabler/icons-react";
import {
	createFileRoute,
	Link,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { IconButton } from "@/components/primitives";
import {
	categoryLabels,
	categoryOrder,
	getArticlesByCategory,
} from "@/content/docs";
import styles from "./route.module.scss";

export const Route = createFileRoute("/docs")({
	component: DocsLayout,
});

function DocsLayout() {
	const { location } = useRouterState();
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<div className={styles.layout}>
			{/* モバイルヘッダー */}
			<div className={styles.mobileHeader}>
				<IconButton
					onClick={() => setMobileOpen(true)}
					aria-label="メニューを開く"
				>
					<IconMenu2 size={20} />
				</IconButton>
				<Link to="/">
					<img src="/sos.svg" alt="雙峰祭オンラインシステム" height={36} />
				</Link>
			</div>

			{/* モバイル背景オーバーレイ */}
			{mobileOpen && (
				<button
					type="button"
					className={styles.backdrop}
					onClick={() => setMobileOpen(false)}
					aria-label="メニューを閉じる"
				/>
			)}

			<aside
				className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ""}`}
			>
				<div className={styles.header}>
					<Link to="/">
						<img src="/sos.svg" alt="雙峰祭オンラインシステム" height={42} />
					</Link>
				</div>
				{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: ナビゲーション時にモバイルメニューを閉じる */}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: nav内のリンクがキーボード操作を担う */}
				<nav className={styles.nav} onClick={() => setMobileOpen(false)}>
					{categoryOrder.map(category => {
						const categoryArticles = getArticlesByCategory(category);
						if (categoryArticles.length === 0) return null;
						return (
							<div key={category} className={styles.section}>
								<Text size="1" weight="bold" className={styles.navLabel}>
									{categoryLabels[category]}
								</Text>
								{categoryArticles.map(article => {
									const active = location.pathname === `/docs/${article.slug}`;
									return (
										<Link
											key={article.slug}
											to="/docs/$slug"
											params={{ slug: article.slug }}
											className={styles.link}
										>
											<div
												className={`${styles.item} ${active ? styles.active : ""}`}
											>
												<IconFileText size={16} />
												<Text size="2">{article.title}</Text>
											</div>
										</Link>
									);
								})}
							</div>
						);
					})}
				</nav>
			</aside>
			<main className={styles.main}>
				<Outlet />
			</main>
		</div>
	);
}
