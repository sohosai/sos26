import { Text } from "@radix-ui/themes";
import { IconFileText } from "@tabler/icons-react";
import {
	createFileRoute,
	Link,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
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
	const navigate = useNavigate();
	const currentSlug = location.pathname.startsWith("/docs/")
		? location.pathname.slice("/docs/".length)
		: "";

	const handleChangeArticle = (slug: string) => {
		if (!slug) return;
		navigate({
			to: "/docs/$slug",
			params: { slug },
		});
	};

	return (
		<div className={styles.layout}>
			<aside className={styles.sidebar}>
				<div className={styles.header}>
					<Link to="/">
						<img src="/sos.svg" alt="雙峰祭オンラインシステム" height={42} />
					</Link>
				</div>
				<nav className={styles.nav}>
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
				<div className={styles.switcherBar}>
					<select
						id="docs-article-switcher"
						className={styles.switcherSelect}
						value={currentSlug}
						onChange={e => handleChangeArticle(e.target.value)}
					>
						{categoryOrder.map(category => {
							const categoryArticles = getArticlesByCategory(category);
							if (categoryArticles.length === 0) return null;
							return (
								<optgroup key={category} label={categoryLabels[category]}>
									{categoryArticles.map(article => (
										<option key={article.slug} value={article.slug}>
											{article.title}
										</option>
									))}
								</optgroup>
							);
						})}
					</select>
				</div>
				<Outlet />
			</main>
		</div>
	);
}
