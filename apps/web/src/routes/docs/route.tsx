import { Text } from "@radix-ui/themes";
import { IconFileText } from "@tabler/icons-react";
import {
	createFileRoute,
	Link,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { articles } from "@/content/docs";
import styles from "./route.module.scss";

export const Route = createFileRoute("/docs")({
	component: DocsLayout,
});

function DocsLayout() {
	const { location } = useRouterState();

	return (
		<div className={styles.layout}>
			<aside className={styles.sidebar}>
				<div className={styles.header}>
					<Link to="/">
						<img src="/sos.svg" alt="雙峰祭オンラインシステム" height={42} />
					</Link>
				</div>
				<nav className={styles.nav}>
					<Text size="1" weight="bold" className={styles.navLabel}>
						ドキュメント
					</Text>
					{articles.map(article => {
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
				</nav>
			</aside>
			<main className={styles.main}>
				<Outlet />
			</main>
		</div>
	);
}
