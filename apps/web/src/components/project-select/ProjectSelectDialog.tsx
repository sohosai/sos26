import { Dialog, Text } from "@radix-ui/themes";
import { IconCheck, IconX } from "@tabler/icons-react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/patterns/DataTable";
import { Button, IconButton } from "@/components/primitives";
import { listCommitteeProjects } from "@/lib/api/committee-project";
import styles from "./ProjectSelectDialog.module.scss";

type Project = {
	id: string;
	number: number;
	name: string;
	type: string;
	organizationName: string;
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
	STAGE: "ステージ",
	FOOD: "飲食",
	NORMAL: "一般",
};

const projectColumns: ColumnDef<Project, unknown>[] = [
	{
		accessorKey: "number",
		header: "企画番号",
		meta: { filterVariant: "number" as const },
	},
	{
		accessorKey: "name",
		header: "企画名",
		meta: { filterVariant: "text" as const },
	},
	{
		accessorKey: "type",
		header: "種別",
		cell: ({ getValue }) =>
			PROJECT_TYPE_LABELS[getValue<string>()] ?? getValue<string>(),
		meta: {
			filterVariant: "select" as const,
			selectOptions: [
				{ value: "STAGE", label: "ステージ" },
				{ value: "FOOD", label: "飲食" },
				{ value: "NORMAL", label: "一般" },
			],
		},
	},
	{
		accessorKey: "organizationName",
		header: "団体名",
		meta: { filterVariant: "text" as const },
	},
];

type ProjectSelectDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedIds: Set<string>;
	onConfirm: (ids: Set<string>) => void;
	title?: string;
};

export function ProjectSelectDialog({
	open,
	onOpenChange,
	selectedIds,
	onConfirm,
	title = "配信先プロジェクトを選択",
}: ProjectSelectDialogProps) {
	const [projects, setProjects] = useState<Project[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [draftIds, setDraftIds] = useState<Set<string>>(new Set());

	// ダイアログが開いたら親の selectedIds を draft にコピー
	useEffect(() => {
		if (open) {
			setDraftIds(new Set(selectedIds));
		}
	}, [open, selectedIds]);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setIsLoading(true);
		listCommitteeProjects()
			.then(res => {
				if (!cancelled) {
					setProjects(
						res.projects.map(p => ({
							id: p.id,
							number: p.number,
							name: p.name,
							type: p.type,
							organizationName: p.organizationName,
						}))
					);
				}
			})
			.catch(() => {
				if (!cancelled) setError("企画一覧の取得に失敗しました。");
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open]);

	// selectedIds → DataTable の initialRowSelection 形式に変換
	const initialRowSelection = useMemo<RowSelectionState>(() => {
		const state: RowSelectionState = {};
		for (const id of selectedIds) {
			state[id] = true;
		}
		return state;
	}, [selectedIds]);

	const handleRowSelectionChange = useMemo(() => {
		return (rows: Project[]) => {
			setDraftIds(new Set(rows.map(r => r.id)));
		};
	}, []);

	const handleConfirm = () => {
		onConfirm(draftIds);
		onOpenChange(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="900px" minHeight="560px">
				<div className={styles.header}>
					<Dialog.Title mb="0">{title}</Dialog.Title>
					<IconButton aria-label="閉じる" onClick={() => onOpenChange(false)}>
						<IconX size={16} />
					</IconButton>
				</div>
				<Dialog.Description size="2" mb="4" color="gray">
					企画を検索・フィルターして選択してください。
				</Dialog.Description>

				<div className={styles.tableWrapper}>
					{isLoading ? (
						<Text size="2" color="gray">
							読み込み中...
						</Text>
					) : error ? (
						<Text size="2" color="red">
							{error}
						</Text>
					) : (
						<DataTable
							data={projects}
							columns={projectColumns}
							features={{
								rowSelection: true,
								columnFilter: true,
								globalFilter: true,
								sorting: true,
								columnVisibility: false,
								csvExport: false,
							}}
							getRowId={row => row.id}
							initialRowSelection={initialRowSelection}
							onRowSelectionChange={handleRowSelectionChange}
						/>
					)}
				</div>

				<div className={styles.footer}>
					<Text size="2" color="gray">
						{draftIds.size > 0
							? `${draftIds.size}件選択中`
							: "企画が選択されていません"}
					</Text>
					<div className={styles.footerActions}>
						<Button
							intent="secondary"
							size="2"
							onClick={() => onOpenChange(false)}
						>
							キャンセル
						</Button>
						<Button
							intent="primary"
							size="2"
							onClick={handleConfirm}
							disabled={draftIds.size === 0}
						>
							<IconCheck size={16} />
							確定（{draftIds.size}件）
						</Button>
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
