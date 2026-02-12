import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
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
		return (
			<div>
				<Heading size="5" mb="2">
					記事が見つかりません
				</Heading>
				<Text color="gray">
					お探しの記事は存在しないか、移動した可能性があります。
				</Text>
			</div>
		);
	}

	return <MarkdownRenderer content={article.content} />;
}
