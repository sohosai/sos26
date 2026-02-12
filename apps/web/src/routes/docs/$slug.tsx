import { createFileRoute, notFound } from "@tanstack/react-router";
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer";
import { getArticleBySlug } from "@/content/docs";

export const Route = createFileRoute("/docs/$slug")({
	component: DocArticlePage,
	head: ({ params }) => {
		const article = getArticleBySlug(params.slug);
		return {
			meta: [
				{
					title: article
						? `${article.title} | 雙峰祭オンラインシステム`
						: "ドキュメント | 雙峰祭オンラインシステム",
				},
			],
		};
	},
});

function DocArticlePage() {
	const { slug } = Route.useParams();
	const article = getArticleBySlug(slug);

	if (!article) {
		throw notFound();
	}

	return <MarkdownRenderer content={article.content} />;
}
