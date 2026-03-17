import { Badge, Spinner, Text } from "@radix-ui/themes";
import type {
	BatchMastersheetHistoryResponse,
	FormItemEditHistoryTrigger,
	GetMastersheetDataResponse,
} from "@sos26/shared";
import { IconFileText, IconHistory, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components/primitives";
import { batchMastersheetHistory } from "@/lib/api/committee-mastersheet";
import styles from "./HistoryPanel.module.scss";
import type { SelectedCell } from "./MastersheetTable";

// ─────────────────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────────────────

type ApiColumn = GetMastersheetDataResponse["columns"][number];
type HistoryEntry =
	BatchMastersheetHistoryResponse["groups"][number]["history"][number];

type CellHistoryGroup = {
	columnId: string;
	projectId: string;
	columnName: string;
	projectLabel: string;
	history: HistoryEntry[];
};

type Props = {
	ref?: React.Ref<HTMLDivElement>;
	open: boolean;
	onClose: () => void;
	columns: GetMastersheetDataResponse["columns"];
	rows: GetMastersheetDataResponse["rows"];
	selectedCells: SelectedCell[];
};

// ─────────────────────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────────────────────

const TRIGGER_LABEL: Record<FormItemEditHistoryTrigger, string> = {
	PROJECT_SUBMIT: "提出",
	PROJECT_RESUBMIT: "再提出",
	COMMITTEE_EDIT: "委員編集",
};

const TRIGGER_COLOR: Record<
	FormItemEditHistoryTrigger,
	"green" | "orange" | "blue"
> = {
	PROJECT_SUBMIT: "green",
	PROJECT_RESUBMIT: "orange",
	COMMITTEE_EDIT: "blue",
};

function formatDateTime(date: Date | string): string {
	const d = new Date(date);
	const month = d.getMonth() + 1;
	const day = d.getDate();
	const hours = String(d.getHours()).padStart(2, "0");
	const minutes = String(d.getMinutes()).padStart(2, "0");
	return `${month}/${day} ${hours}:${minutes}`;
}

function formatValue(
	entry: HistoryEntry,
	column: ApiColumn | undefined
): string {
	if (entry.value.files.length > 0)
		return `ファイル${entry.value.files.length}件`;
	if (entry.value.numberValue != null) return String(entry.value.numberValue);
	if (entry.value.selectedOptionIds.length > 0 && column) {
		return entry.value.selectedOptionIds
			.map(id => column.options.find(o => o.id === id)?.label ?? id)
			.join(", ");
	}
	if (entry.value.textValue) return entry.value.textValue;
	return "（空）";
}

/** 重複を除いた FORM_ITEM セルのキーリストを返す */
function getFormItemCells(
	cells: SelectedCell[],
	columns: ApiColumn[]
): { columnId: string; projectId: string }[] {
	const formItemColumnIds = new Set(
		columns.filter(c => c.type === "FORM_ITEM").map(c => c.id)
	);
	const seen = new Set<string>();
	const result: { columnId: string; projectId: string }[] = [];
	for (const cell of cells) {
		if (!formItemColumnIds.has(cell.columnId)) continue;
		const key = `${cell.columnId}:${cell.projectId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(cell);
	}
	return result;
}

// ─────────────────────────────────────────────────────────────
// コンポーネント
// ─────────────────────────────────────────────────────────────

export function HistoryPanel({
	ref,
	open,
	onClose,
	columns,
	rows,
	selectedCells,
}: Props) {
	const [groups, setGroups] = useState<CellHistoryGroup[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const columnMap = useMemo(
		() => new Map(columns.map(c => [c.id, c])),
		[columns]
	);
	const projectMap = useMemo(
		() => new Map(rows.map(r => [r.project.id, r.project])),
		[rows]
	);

	const hasSelection = selectedCells.length > 0;

	const formItemCells = useMemo(
		() => getFormItemCells(selectedCells, columns),
		[selectedCells, columns]
	);

	const prevSelectionKeyRef = useRef("");

	useEffect(() => {
		if (!open) return;

		const cellsToFetch = formItemCells;

		// 内容が変わっていなければスキップ
		const selectionKey = cellsToFetch
			.map(c => `${c.columnId}:${c.projectId}`)
			.sort()
			.join(",");
		if (selectionKey === prevSelectionKeyRef.current) return;
		prevSelectionKeyRef.current = selectionKey;

		// セル未選択 or FORM_ITEM が 0 件なら空表示
		if (cellsToFetch.length === 0) {
			setGroups([]);
			setLoading(false);
			setError(null);
			return;
		}

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setLoading(true);
		setError(null);

		batchMastersheetHistory(cellsToFetch, controller.signal)
			.then(res => {
				if (controller.signal.aborted) return;

				const newGroups: CellHistoryGroup[] = res.groups.map(g => ({
					columnId: g.columnId,
					projectId: g.projectId,
					columnName: columnMap.get(g.columnId)?.name ?? g.columnId,
					projectLabel: projectMap.get(g.projectId)?.name ?? g.projectId,
					history: g.history,
				}));

				// 最新順にソート
				newGroups.sort((a, b) => {
					const aDate = a.history[0]?.createdAt ?? new Date(0);
					const bDate = b.history[0]?.createdAt ?? new Date(0);
					return new Date(bDate).getTime() - new Date(aDate).getTime();
				});

				setGroups(newGroups);
				setLoading(false);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setError("履歴の取得に失敗しました");
					setLoading(false);
				}
			});

		return () => controller.abort();
	}, [open, formItemCells, columnMap, projectMap]);

	if (!open) return null;

	const formCellCount = hasSelection ? formItemCells.length : null;

	return (
		<div ref={ref} className={styles.panel}>
			<div className={styles.header}>
				<div className={styles.headerLeft}>
					<div className={styles.headerTitle}>
						<IconHistory size={18} />
						<Text size="3" weight="bold">
							編集履歴
						</Text>
						{formCellCount !== null && (
							<Badge size="1" variant="soft">
								{formCellCount}件のセル
							</Badge>
						)}
					</div>
					<Text size="1" color="gray">
						<IconFileText
							size={11}
							style={{
								display: "inline",
								verticalAlign: "middle",
								marginRight: 2,
							}}
						/>
						申請由来カラムの変更履歴を表示
					</Text>
				</div>
				<IconButton
					size="1"
					intent="secondary"
					onClick={onClose}
					aria-label="閉じる"
				>
					<IconX size={16} />
				</IconButton>
			</div>

			<div className={styles.content}>
				{loading && (
					<div className={styles.loading}>
						<Spinner size="3" />
					</div>
				)}

				{error && (
					<div className={styles.error}>
						<Text size="2" color="red">
							{error}
						</Text>
					</div>
				)}

				{!loading && !error && groups.length === 0 && (
					<div className={styles.emptyState}>
						<IconHistory size={32} style={{ color: "var(--gray-7)" }} />
						<Text size="2" color="gray">
							{hasSelection
								? "選択中の申請由来セルに履歴がありません"
								: "セルを選択すると履歴が表示されます"}
						</Text>
					</div>
				)}

				{!loading &&
					!error &&
					groups.map(group => (
						<div
							key={`${group.columnId}:${group.projectId}`}
							className={styles.cellGroup}
						>
							<div className={styles.cellGroupHeader}>
								<Text size="2" weight="medium">
									{group.projectLabel}
								</Text>
								<Text size="1" color="gray">
									{group.columnName}
								</Text>
							</div>
							{group.history.map((entry, i) => (
								<div key={entry.id} className={styles.historyItem}>
									<div className={styles.timeline}>
										<div
											className={`${styles.dot} ${
												entry.trigger === "PROJECT_SUBMIT"
													? styles.dotSubmit
													: entry.trigger === "PROJECT_RESUBMIT"
														? styles.dotResubmit
														: styles.dotEdit
											}`}
										/>
										{i < group.history.length - 1 && (
											<div className={styles.line} />
										)}
									</div>
									<div className={styles.itemContent}>
										<div className={styles.itemHeader}>
											<Badge
												size="1"
												color={TRIGGER_COLOR[entry.trigger]}
												variant="soft"
											>
												{TRIGGER_LABEL[entry.trigger]}
											</Badge>
											<Text size="1" color="gray">
												{entry.actor.name}
											</Text>
											<Text size="1" color="gray">
												{formatDateTime(entry.createdAt)}
											</Text>
										</div>
										<div className={styles.itemValue}>
											<Text size="2">
												{formatValue(entry, columnMap.get(group.columnId))}
											</Text>
										</div>
									</div>
								</div>
							))}
						</div>
					))}
			</div>
		</div>
	);
}
