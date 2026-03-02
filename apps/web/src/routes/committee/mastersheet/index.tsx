import { Heading, Text } from "@radix-ui/themes";
import { IconLayoutColumns } from "@tabler/icons-react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/primitives";
import { getMastersheetData } from "@/lib/api/committee-mastersheet";
import { ColumnManagerDialog } from "./-components/ColumnManagerDialog";
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
	const router = useRouter();
	const [dialogOpen, setDialogOpen] = useState(false);

	async function handleDialogSuccess() {
		await router.invalidate();
	}

	const manageButton = (
		<Button intent="secondary" onClick={() => setDialogOpen(true)}>
			<IconLayoutColumns size={16} /> カラムを管理
		</Button>
	);

	return (
		<div>
			<div style={{ marginBottom: 16 }}>
				<Heading size="6">マスターシート</Heading>
				<Text size="2" color="gray">
					企画データの一覧・編集ができます。
				</Text>
			</div>
			<MastersheetTable
				columns={columns}
				rows={rows}
				toolbarExtra={manageButton}
			/>
			<ColumnManagerDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				columns={columns}
				onSuccess={handleDialogSuccess}
			/>
		</div>
	);
}
