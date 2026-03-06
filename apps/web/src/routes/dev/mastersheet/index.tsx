import { Box, Heading, Separator, Text } from "@radix-ui/themes";
import type { MastersheetCellStatus } from "@sos26/shared";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import {
	DataTable,
	EditableCell,
	FileCell,
	FormCellStatusBadge,
	MultiSelectCell,
} from "@/components/patterns";

export const Route = createFileRoute("/dev/mastersheet/")({
	component: MastersheetDemoPage,
	head: () => ({
		meta: [{ title: "マスターシート DataTable サンプル" }],
	}),
});

// ─── サンプルデータ型 ────────────────────────────────────

type ProjectRow = {
	number: number;
	name: string;
	type: string;
	categories: string[];
	budget: number | null;
	fileUrl: string | null;
	formStatus: MastersheetCellStatus;
};

const CATEGORY_OPTIONS = [
	{ value: "stage", label: "ステージ" },
	{ value: "food", label: "模擬店" },
	{ value: "exhibition", label: "展示" },
	{ value: "outdoor", label: "屋外" },
	{ value: "indoor", label: "屋内" },
];

const TYPE_OPTIONS = [
	{ value: "general", label: "一般" },
	{ value: "athletic", label: "体育会" },
	{ value: "culture", label: "文化" },
];

const STATUS_OPTIONS: { value: MastersheetCellStatus; label: string }[] = [
	{ value: "NOT_DELIVERED", label: "未配信" },
	{ value: "NOT_ANSWERED", label: "未回答" },
	{ value: "SUBMITTED", label: "提出済み" },
	{ value: "COMMITTEE_EDITED", label: "実委編集" },
];

const sampleData: ProjectRow[] = [
	{
		number: 1,
		name: "筑波大学吹奏楽団",
		type: "culture",
		categories: ["stage", "indoor"],
		budget: 150000,
		fileUrl: "https://example.com/files/report1.pdf",
		formStatus: "SUBMITTED",
	},
	{
		number: 2,
		name: "ロボコンサークル展示",
		type: "general",
		categories: ["exhibition", "indoor"],
		budget: 80000,
		fileUrl: null,
		formStatus: "NOT_ANSWERED",
	},
	{
		number: 3,
		name: "野外ステージライブ",
		type: "athletic",
		categories: ["stage", "outdoor"],
		budget: 200000,
		fileUrl: "https://example.com/files/report3.pdf",
		formStatus: "COMMITTEE_EDITED",
	},
	{
		number: 4,
		name: "模擬店：唐揚げ",
		type: "general",
		categories: ["food", "outdoor"],
		budget: 50000,
		fileUrl: null,
		formStatus: "NOT_ANSWERED",
	},
	{
		number: 5,
		name: "科学実験教室",
		type: "culture",
		categories: ["exhibition", "indoor"],
		budget: null,
		fileUrl: null,
		formStatus: "NOT_DELIVERED",
	},
	{
		number: 6,
		name: "ダンスサークル発表",
		type: "culture",
		categories: ["stage", "indoor"],
		budget: 120000,
		fileUrl: "https://example.com/files/report6.pdf",
		formStatus: "SUBMITTED",
	},
];

// ─── カラム定義 ──────────────────────────────────────────

const col = createColumnHelper<ProjectRow>();

const columns = [
	col.accessor("number", {
		header: "企画番号",
		meta: { filterVariant: "number" as const },
	}),
	col.accessor("name", {
		header: "企画名",
		cell: EditableCell,
		meta: { editable: false, filterVariant: "text" as const },
	}),
	col.accessor("type", {
		header: "種別",
		cell: ({ getValue }) => {
			const v = getValue();
			return TYPE_OPTIONS.find(o => o.value === v)?.label ?? v;
		},
		meta: {
			filterVariant: "select" as const,
			selectOptions: TYPE_OPTIONS,
		},
	}),
	col.accessor("categories", {
		header: "カテゴリ",
		cell: MultiSelectCell,
		meta: {
			selectOptions: CATEGORY_OPTIONS,
			filterVariant: "select" as const,
		},
		enableSorting: false,
	}),
	col.accessor("budget", {
		header: "予算（円）",
		cell: ({ getValue }) => {
			const v = getValue();
			return v == null ? <Text color="gray">-</Text> : v.toLocaleString();
		},
		meta: { filterVariant: "number" as const },
	}),
	col.accessor("fileUrl", {
		header: "添付ファイル",
		cell: FileCell,
		enableSorting: false,
	}),
	col.accessor("formStatus", {
		header: "フォーム状態",
		cell: ({ getValue }) => (
			<FormCellStatusBadge status={getValue() as MastersheetCellStatus} />
		),
		enableSorting: false,
		meta: {
			filterVariant: "select" as const,
			selectOptions: STATUS_OPTIONS,
		},
	}),
];

// ─── Page ───────────────────────────────────────────────

function MastersheetDemoPage() {
	const [selected, setSelected] = useState<ProjectRow[]>([]);

	return (
		<Box p="5">
			<Heading size="6" mb="2">
				マスターシート DataTable サンプル
			</Heading>
			<Text size="2" color="gray" mb="5" as="p">
				Phase 4 で追加した機能のデモ: columnFilter / rowSelection /
				MultiSelectCell / FileCell / FormCellStatusBadge
			</Text>

			{/* サンプル1: columnFilter */}
			<Heading size="4" mb="1">
				カラムフィルター（columnFilter=true）
			</Heading>
			<Text size="2" color="gray" mb="3" as="p">
				各カラムヘッダーの ▼ アイコンからカラム個別のフィルターが使えます。
			</Text>
			<DataTable
				data={sampleData}
				columns={columns}
				features={{
					columnFilter: true,
					selection: false,
					copy: false,
				}}
			/>

			<Separator my="6" size="4" />

			{/* サンプル2: rowSelection */}
			<Heading size="4" mb="1">
				行選択（rowSelection=true）
			</Heading>
			<Text size="2" color="gray" mb="3" as="p">
				チェックボックスで行を選択できます（配信先指定などに使用）。
				{selected.length > 0 && (
					<> 選択中: {selected.map(r => `#${r.number}`).join(", ")}</>
				)}
			</Text>
			<DataTable
				data={sampleData}
				columns={columns}
				features={{
					rowSelection: true,
					columnFilter: true,
					csvExport: false,
				}}
				getRowId={row => String(row.number)}
				onRowSelectionChange={setSelected}
			/>
		</Box>
	);
}
