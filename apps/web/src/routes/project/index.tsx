import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/auth";

export const Route = createFileRoute("/project/")({
	component: ProjectIndexPage,
	head: () => ({
		meta: [
			{ title: "企画一覧 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "企画一覧ページ" },
		],
	}),
});

function ProjectIndexPage() {
	const { user } = useAuthStore();

	return (
		<div>
			<Heading size="6">企画一覧</Heading>
			<Text as="p" size="2" color="gray">
				ようこそ、{user?.name} さん
			</Text>
		</div>
	);
}
