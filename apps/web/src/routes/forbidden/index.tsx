import { createFileRoute } from "@tanstack/react-router";
import { ForbiddenContent } from "@/components/layout/ForbiddenContent";

export const Route = createFileRoute("/forbidden/")({
	component: ForbiddenContent,
	head: () => ({
		meta: [
			{ title: "アクセス権限がありません | 雙峰祭オンラインシステム" },
			{
				name: "description",
				content: "このページへのアクセス権限がありません",
			},
		],
	}),
});
