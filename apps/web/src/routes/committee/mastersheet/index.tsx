import { Heading, Text } from "@radix-ui/themes";
import { IconLayoutColumns } from "@tabler/icons-react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import type { SortingState, VisibilityState } from "@tanstack/react-table";
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

function MastersheetPage() {
	const { columns, rows } = Route.useLoaderData();
	const router = useRouter();
	const [columnPanelOpen, setColumnPanelOpen] = useState(false);
	const [tableKey, setTableKey] = useState(0);
	const [sorting, setSorting] = useState<SortingState | undefined>(undefined);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
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

		// knownColumnIds が空（旧形式 or 初期ビュー）なら全カラムを表示
		// それ以外は未収録カラムをデフォルト非表示にして、ビュー間の独立性を保つ
		const savedVisibility = viewState.columnVisibility ?? {};
		const knownIds = new Set(viewState.knownColumnIds ?? []);
		const completeVisibility: VisibilityState = {};
		for (const col of columns) {
			// knownColumnIds に含まれていれば保存値を使用（デフォルト: 表示）
			// 含まれていなければ、このビュー作成後に追加されたカラムなので非表示
			completeVisibility[col.id] = knownIds.has(col.id)
				? (savedVisibility[col.id] ?? true)
				: false;
		}
		setColumnVisibility(completeVisibility);
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
					columnVisibility,
					knownColumnIds: columns.map(c => c.id),
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
				onSortingChange={handleSortingChange}
				onColumnVisibilityChange={handleColumnVisibilityChange}
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
