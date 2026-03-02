import { Flex, Heading, Text } from "@radix-ui/themes";
import { IconLayoutColumns, IconSearch } from "@tabler/icons-react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/primitives";
import { getMastersheetData } from "@/lib/api/committee-mastersheet";
import { ColumnDiscoverDialog } from "./-components/ColumnDiscoverDialog";
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
	const [manageOpen, setManageOpen] = useState(false);
	const [discoverOpen, setDiscoverOpen] = useState(false);

	async function handleManageSuccess() {
		await router.invalidate();
	}

	const toolbarButtons = (
		<Flex gap="2">
			<Button intent="secondary" onClick={() => setDiscoverOpen(true)}>
				<IconSearch size={16} /> カラムを探す
			</Button>
			<Button intent="secondary" onClick={() => setManageOpen(true)}>
				<IconLayoutColumns size={16} /> カラムを管理
			</Button>
		</Flex>
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
				toolbarExtra={toolbarButtons}
			/>
			<ColumnManagerDialog
				open={manageOpen}
				onOpenChange={setManageOpen}
				columns={columns}
				onSuccess={handleManageSuccess}
			/>
			<ColumnDiscoverDialog
				open={discoverOpen}
				onOpenChange={setDiscoverOpen}
			/>
		</div>
	);
}
