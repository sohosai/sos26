import committeeGuide from "./committee-guide.md?raw";
import gettingStarted from "./getting-started.md?raw";
import projectGuide from "./project-guide.md?raw";

export type DocCategory = "general" | "project" | "committee";

export type DocArticle = {
	slug: string;
	title: string;
	category: DocCategory;
	content: string;
};

export const categoryLabels: Record<DocCategory, string> = {
	general: "全体",
	project: "企画人向け",
	committee: "実委人向け",
};

export const categoryOrder: DocCategory[] = ["general", "project", "committee"];

export const articles: DocArticle[] = [
	{
		slug: "getting-started",
		title: "はじめに",
		category: "general",
		content: gettingStarted,
	},
	{
		slug: "project-guide",
		title: "企画人ガイド",
		category: "project",
		content: projectGuide,
	},
	{
		slug: "committee-guide",
		title: "実委人ガイド",
		category: "committee",
		content: committeeGuide,
	},
];

export function getArticleBySlug(slug: string): DocArticle | undefined {
	return articles.find(article => article.slug === slug);
}

export function getArticlesByCategory(category: DocCategory): DocArticle[] {
	return articles.filter(article => article.category === category);
}
