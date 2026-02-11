import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/auth";

export const Route = createFileRoute("/committee/")({
	component: CommitteeIndexPage,
	head: () => ({
		meta: [
			{ title: "委員会ダッシュボード | 雙峰祭オンラインシステム" },
			{ name: "description", content: "委員会ダッシュボード" },
		],
	}),
});

function CommitteeIndexPage() {
	const { user } = useAuthStore();

	return (
		<div style={{ padding: "2rem" }}>
			<Heading size="6">委員会ダッシュボード</Heading>
			<Text as="p" color="gray">
				ようこそ、{user?.name} さん
			</Text>
			{/* ここに委員会向け機能を実装 */}
		</div>
	);
}
