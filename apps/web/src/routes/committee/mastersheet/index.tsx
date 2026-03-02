import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { getMastersheetData } from "@/lib/api/committee-mastersheet";
import { MastersheetTable } from "./-components/MastersheetTable";

export const Route = createFileRoute("/committee/mastersheet/")({
	loader: async () => {
		return await getMastersheetData();
	},
	head: () => ({
		meta: [
			{ title: "マスターシート | 雙峰祭オンラインシステム" },
			{ name: "description", content: "マスターシート" },
		],
	}),
	component: MastersheetPage,
});

function MastersheetPage() {
	const { columns, rows } = Route.useLoaderData();

	return (
		<div>
			<div style={{ marginBottom: 16 }}>
				<Heading size="6">マスターシート</Heading>
				<Text size="2" color="gray">
					企画データの一覧・編集ができます。
				</Text>
			</div>
			<MastersheetTable columns={columns} rows={rows} />
		</div>
	);
}
