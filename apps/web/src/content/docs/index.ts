import gettingStarted from "./getting-started.md?raw";

export type DocArticle = {
	slug: string;
	title: string;
	content: string;
};

export const articles: DocArticle[] = [
	{
		slug: "getting-started",
		title: "はじめに",
		content: gettingStarted,
	},
];

export function getArticleBySlug(slug: string): DocArticle | undefined {
	return articles.find(article => article.slug === slug);
}
