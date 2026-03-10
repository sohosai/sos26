import { Badge, Spinner, Text } from "@radix-ui/themes";
import type {
	FormItemEditHistoryTrigger,
	GetMastersheetDataResponse,
	GetMastersheetHistoryResponse,
} from "@sos26/shared";
import { IconFileText, IconHistory, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components/primitives";
import { getMastersheetHistory } from "@/lib/api/committee-mastersheet";
import styles from "./HistoryPanel.module.scss";
import type { SelectedCell } from "./MastersheetTable";

// ─────────────────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────────────────

type ApiColumn = GetMastersheetDataResponse["columns"][number];
type HistoryEntry = GetMastersheetHistoryResponse["history"][number];

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

function formatDateTime(date: Date): string {
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
	if (entry.value.fileUrl) return entry.value.fileUrl;
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

/** 全 FORM_ITEM カラム × 全企画の組み合わせを生成 */
function getAllFormItemCells(
	columns: ApiColumn[],
	rows: GetMastersheetDataResponse["rows"]
): { columnId: string; projectId: string }[] {
	const formItemColumns = columns.filter(c => c.type === "FORM_ITEM");
	const result: { columnId: string; projectId: string }[] = [];
	for (const col of formItemColumns) {
		for (const row of rows) {
			result.push({ columnId: col.id, projectId: row.project.id });
		}
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

	useEffect(() => {
		if (!open) return;

		const cellsToFetch = hasSelection
			? getFormItemCells(selectedCells, columns)
			: getAllFormItemCells(columns, rows);

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

		Promise.all(
			cellsToFetch.map(async cell => {
				const res = await getMastersheetHistory(cell.columnId, cell.projectId);
				return { ...cell, history: res.history };
			})
		)
			.then(results => {
				if (controller.signal.aborted) return;

				const newGroups: CellHistoryGroup[] = results
					.filter(r => r.history.length > 0)
					.map(r => ({
						columnId: r.columnId,
						projectId: r.projectId,
						columnName: columnMap.get(r.columnId)?.name ?? r.columnId,
						projectLabel: projectMap.get(r.projectId)?.name ?? r.projectId,
						history: r.history,
					}));

				// 全履歴表示時は最新順にソート
				if (!hasSelection) {
					newGroups.sort((a, b) => {
						const aDate = a.history[0]?.createdAt ?? new Date(0);
						const bDate = b.history[0]?.createdAt ?? new Date(0);
						return new Date(bDate).getTime() - new Date(aDate).getTime();
					});
				}

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
	}, [open, selectedCells, columns, rows, hasSelection, columnMap, projectMap]);

	if (!open) return null;

	const formCellCount = hasSelection
		? getFormItemCells(selectedCells, columns).length
		: null;

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
						フォーム由来カラムの変更履歴を表示
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
								? "選択中のフォーム由来セルに履歴がありません"
								: "フォーム由来カラムの履歴がありません"}
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
