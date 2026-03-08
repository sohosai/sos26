import { Heading, Text } from "@radix-ui/themes";
import { IconLayoutColumns } from "@tabler/icons-react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import type {
	ColumnFiltersState,
	SortingState,
	VisibilityState,
} from "@tanstack/react-table";
import { useState } from "react";
import { Button } from "@/components/primitives";
import { getMastersheetData } from "@/lib/api/committee-mastersheet";
import { ColumnPanel } from "./-components/ColumnPanel";
import { MastersheetTable } from "./-components/MastersheetTable";
import { type ViewState, ViewTabs } from "./-components/ViewTabs";

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

const FIXED_COLUMN_IDS = [
	"number",
	"name",
	"type",
	"organizationName",
	"ownerName",
	"subOwnerName",
] as const;

function MastersheetPage() {
	const { columns, rows } = Route.useLoaderData();
	const router = useRouter();
	const [columnPanelOpen, setColumnPanelOpen] = useState(false);
	const [tableKey, setTableKey] = useState(0);
	const [sorting, setSorting] = useState<SortingState | undefined>(undefined);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [activeViewId, setActiveViewId] = useState<string | null>(null);

	async function handleColumnSuccess() {
		await router.invalidate();
	}

	function handleSortingChange(newSorting: SortingState) {
		setSorting(newSorting);
	}

	function handleColumnVisibilityChange(visibility: VisibilityState) {
		setColumnVisibility(visibility);
	}

	function handleToggleColumn(columnId: string, visible: boolean) {
		const next = { ...columnVisibility, [columnId]: visible };
		setColumnVisibility(next);
		setTableKey(k => k + 1);
	}

	function handleSelectView(viewId: string, viewState: ViewState) {
		setActiveViewId(viewId);
		setSorting(viewState.sorting);

		const knownIds = new Set(viewState.knownColumnIds ?? []);
		const completeVisibility: VisibilityState = {};
		// 固定カラム：常に表示
		for (const id of FIXED_COLUMN_IDS) {
			completeVisibility[id] = true;
		}
		// 動的カラム：knownColumnIds に含まれていれば表示、なければ非表示
		for (const col of columns) {
			completeVisibility[col.id] = knownIds.has(col.id);
		}
		setColumnVisibility(completeVisibility);
		setColumnFilters(viewState.columnFilters ?? []);
		setTableKey(k => k + 1);
	}

	function handleActiveViewIdChange(viewId: string) {
		setActiveViewId(viewId);
	}

	const toolbarExtra = (
		<Button intent="secondary" onClick={() => setColumnPanelOpen(true)}>
			<IconLayoutColumns size={16} /> カラム
		</Button>
	);

	return (
		<div>
			<div style={{ marginBottom: 8 }}>
				<Heading size="6">マスターシート</Heading>
				<Text size="2" color="gray">
					企画データの一覧・編集ができます。
				</Text>
			</div>
			<ViewTabs
				activeViewId={activeViewId}
				currentState={{
					sorting,
					columnFilters,
					knownColumnIds: [
						...FIXED_COLUMN_IDS,
						...columns
							.filter(c => columnVisibility[c.id] !== false)
							.map(c => c.id),
					],
				}}
				onSelectView={handleSelectView}
				onActiveViewIdChange={handleActiveViewIdChange}
			/>
			<MastersheetTable
				key={tableKey}
				columns={columns}
				rows={rows}
				initialSorting={sorting}
				initialColumnVisibility={columnVisibility}
				initialColumnFilters={columnFilters}
				onSortingChange={handleSortingChange}
				onColumnVisibilityChange={handleColumnVisibilityChange}
				onColumnFiltersChange={setColumnFilters}
				toolbarExtra={toolbarExtra}
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
