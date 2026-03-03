import { Flex, Heading, Text } from "@radix-ui/themes";
import { IconLayoutColumns } from "@tabler/icons-react";
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
import { ColumnPanel } from "./-components/ColumnPanel";
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
	const [columnPanelOpen, setColumnPanelOpen] = useState(false);
	const [tableKey, setTableKey] = useState(0);
	const [tableInitSorting, setTableInitSorting] = useState<
		SortingState | undefined
	>(search.sorting as SortingState | undefined);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
		(search.columnVisibility as VisibilityState | undefined) ?? {}
	);

	async function handleColumnSuccess() {
		await router.invalidate();
	}

	function handleSortingChange(sorting: SortingState) {
		navigate({ search: prev => ({ ...prev, sorting }) });
	}

	function handleColumnVisibilityChange(visibility: VisibilityState) {
		setColumnVisibility(visibility);
		navigate({ search: prev => ({ ...prev, columnVisibility: visibility }) });
	}

	function handleToggleColumn(columnId: string, visible: boolean) {
		const next = { ...columnVisibility, [columnId]: visible };
		setColumnVisibility(next);
		navigate({ search: prev => ({ ...prev, columnVisibility: next }) });
		setTableKey(k => k + 1);
	}

	function handleApplyView(viewState: ViewState) {
		setTableInitSorting(viewState.sorting);
		const nextVisibility = viewState.columnVisibility ?? {};
		setColumnVisibility(nextVisibility);
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
			<Button intent="secondary" onClick={() => setColumnPanelOpen(true)}>
				<IconLayoutColumns size={16} /> カラム
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
				initialSorting={tableInitSorting}
				initialColumnVisibility={columnVisibility}
				onSortingChange={handleSortingChange}
				onColumnVisibilityChange={handleColumnVisibilityChange}
				toolbarExtra={toolbarButtons}
			/>
			<ColumnPanel
				open={columnPanelOpen}
				onOpenChange={setColumnPanelOpen}
				columns={columns}
				columnVisibility={columnVisibility}
				onToggleColumn={handleToggleColumn}
				onSuccess={handleColumnSuccess}
			/>
		</div>
	);
}
