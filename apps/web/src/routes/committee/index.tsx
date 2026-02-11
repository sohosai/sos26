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
		<div>
			<Heading size="6">委員会ダッシュボード</Heading>
			<Text as="p" size="2" color="gray">
				ようこそ、{user?.name} さん
			</Text>
		</div>
	);
}
