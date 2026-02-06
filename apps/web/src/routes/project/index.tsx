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
		<div style={{ padding: "2rem" }}>
			<Heading size="6">企画一覧</Heading>
			<Text as="p" color="gray">
				ようこそ、{user?.lastName} {user?.firstName} さん（{user?.role}）
			</Text>
			{/* ここに企画一覧を実装 */}
		</div>
	);
}
