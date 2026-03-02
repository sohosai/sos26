import { Flex, Heading, Text } from "@radix-ui/themes";
import { IconLayoutColumns, IconSearch } from "@tabler/icons-react";
import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import type { SortingState, VisibilityState } from "@tanstack/react-table";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/primitives";
import { getMastersheetData } from "@/lib/api/committee-mastersheet";
import { ColumnDiscoverDialog } from "./-components/ColumnDiscoverDialog";
import { ColumnManagerDialog } from "./-components/ColumnManagerDialog";
import { MastersheetTable } from "./-components/MastersheetTable";
import { type ViewState, ViewSwitcher } from "./-components/ViewSwitcher";

const mastersheetSearchSchema = z.object({
	sorting: z
		.array(z.object({ id: z.string(), desc: z.boolean() }))
		.optional()
		.catch(undefined),
	columnVisibility: z
		.record(z.string(), z.boolean())
		.optional()
		.catch(undefined),
});

export const Route = createFileRoute("/committee/mastersheet/")({
	loader: async () => {
		return await getMastersheetData();
	},
	validateSearch: raw => mastersheetSearchSchema.parse(raw),
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
	const search = Route.useSearch();
	const router = useRouter();
	const navigate = useNavigate({ from: "/committee/mastersheet/" });
	const [manageOpen, setManageOpen] = useState(false);
	const [discoverOpen, setDiscoverOpen] = useState(false);
	const [tableKey, setTableKey] = useState(0);
	const [tableInit, setTableInit] = useState<ViewState>({
		sorting: search.sorting as SortingState | undefined,
		columnVisibility: search.columnVisibility as VisibilityState | undefined,
	});

	async function handleManageSuccess() {
		await router.invalidate();
	}

	function handleSortingChange(sorting: SortingState) {
		navigate({ search: prev => ({ ...prev, sorting }) });
	}

	function handleColumnVisibilityChange(columnVisibility: VisibilityState) {
		navigate({ search: prev => ({ ...prev, columnVisibility }) });
	}

	function handleApplyView(viewState: ViewState) {
		setTableInit(viewState);
		navigate({
			search: () => ({
				sorting: viewState.sorting,
				columnVisibility: viewState.columnVisibility,
			}),
		});
		setTableKey(k => k + 1);
	}

	const toolbarButtons = (
		<Flex gap="2">
			<ViewSwitcher
				currentState={{
					sorting: search.sorting,
					columnVisibility: search.columnVisibility,
				}}
				onApply={handleApplyView}
			/>
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
				key={tableKey}
				columns={columns}
				rows={rows}
				initialSorting={tableInit.sorting}
				initialColumnVisibility={tableInit.columnVisibility}
				onSortingChange={handleSortingChange}
				onColumnVisibilityChange={handleColumnVisibilityChange}
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
