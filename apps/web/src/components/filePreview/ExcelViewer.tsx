import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import styles from "./ExcelViewer.module.scss";

// ─── 型定義 ──────────────────────────────────────────────────────────────────

type CellValue = string | number | boolean | null;

/**
 * セル結合マップ
 * キー: "rowIndex,colIndex"（sheet_to_json が返す 0-indexed の行/列）
 * 値:
 *   rowSpan/colSpan > 0 → 結合の起点セル（その値を描画）
 *   rowSpan === 0       → 結合範囲内の非表示セル（null を返して td を skip）
 */
type MergeMap = Map<string, { rowSpan: number; colSpan: number } | null>;

// ─── ユーティリティ ───────────────────────────────────────────────────────────

/**
 * XLSX の !merges（Excel 0-indexed 座標）を
 * sheet_to_json の返す行列インデックス（同じく 0-indexed）向けの MergeMap に変換する。
 *
 * sheet_to_json({ header: 1 }) の結果は rows[r][c] が Excel の行 r・列 c に対応するため、
 * !merges の座標をそのまま使える。
 */
function buildMergeMap(merges: XLSX.Range[] | undefined): MergeMap {
	const map: MergeMap = new Map();
	if (!merges) return map;

	for (const m of merges) {
		const rowSpan = m.e.r - m.s.r + 1;
		const colSpan = m.e.c - m.s.c + 1;

		// 起点セル
		map.set(`${m.s.r},${m.s.c}`, { rowSpan, colSpan });

		// 結合範囲内の非表示セル
		for (let r = m.s.r; r <= m.e.r; r++) {
			for (let c = m.s.c; c <= m.e.c; c++) {
				if (r === m.s.r && c === m.s.c) continue;
				map.set(`${r},${c}`, null); // null = 描画しない
			}
		}
	}

	return map;
}

/**
 * シートの内容から「ヘッダー行数」を推定する。
 * !merges の縦方向結合が行 0 から始まっている場合、その最大終端行 + 1 をヘッダー行数とする。
 * !merges がない or ヘッダーに縦結合がなければ 1 を返す。
 *
 * ※ より厳密にはシート固有のメタ情報が必要だが、
 *   「行 0 から始まる縦結合の最大行数」で実用上ほとんどのケースに対応できる。
 */
function detectHeaderRowCount(merges: XLSX.Range[] | undefined): number {
	if (!merges) return 1;
	let maxRow = 0;
	for (const m of merges) {
		if (m.s.r === 0 && m.e.r > maxRow) {
			maxRow = m.e.r;
		}
	}
	return maxRow + 1;
}

// ─── 型 ──────────────────────────────────────────────────────────────────────

interface SheetData {
	rows: CellValue[][];
	mergeMap: MergeMap;
	headerRowCount: number;
}

interface Props {
	file: File;
}

// ─── コンポーネント ───────────────────────────────────────────────────────────

export default function ExcelViewer({ file }: Props) {
	const [sheets, setSheets] = useState<Record<string, SheetData>>({});
	const [names, setNames] = useState<string[]>([]);
	const [active, setActive] = useState("");

	// ファイルが変わったときだけパース
	const prevFile = useRef<File | null>(null);
	useEffect(() => {
		if (prevFile.current === file) return;
		prevFile.current = file;

		file.arrayBuffer().then(buf => {
			const wb = XLSX.read(buf, { type: "array" });
			const parsed: Record<string, SheetData> = {};

			for (const name of wb.SheetNames) {
				const sheet = wb.Sheets[name];
				if (!sheet) continue;

				const merges = sheet["!merges"];
				parsed[name] = {
					rows: XLSX.utils.sheet_to_json<CellValue[]>(sheet, {
						header: 1,
						defval: null,
					}),
					mergeMap: buildMergeMap(merges),
					headerRowCount: detectHeaderRowCount(merges),
				};
			}

			setSheets(parsed);
			setNames(wb.SheetNames);
			setActive(wb.SheetNames[0] ?? "");
		});
	}, [file]);

	// ─── 表示対象シートのデータ ─────────────────────────────────────────────────

	const sheetData = sheets[active];
	const rows = sheetData?.rows ?? [];
	const mergeMap = sheetData?.mergeMap ?? new Map();
	const headerRowCount = sheetData?.headerRowCount ?? 1;

	// rows[0..headerRowCount-1] = ヘッダー行群
	// rows[headerRowCount..]    = ボディ行群
	const headerRows = rows.slice(0, headerRowCount);
	const bodyRows = rows.slice(headerRowCount);

	// 最大列数（ヘッダー行の最大列数）
	const colCount = Math.max(0, ...headerRows.map(r => r.length));

	// ─── セルレンダラ ────────────────────────────────────────────────────────────

	/**
	 * rowIndex: sheet_to_json の 0-indexed 行インデックス（= !merges の座標と一致）
	 * colIndex: 同列インデックス
	 */
	const renderCell = (
		Tag: "th" | "td",
		rowIndex: number,
		colIndex: number,
		value: CellValue,
		key: string
	) => {
		const mergeKey = `${rowIndex},${colIndex}`;
		const merge = mergeMap.get(mergeKey);

		// 結合範囲内の非表示セル
		if (merge === null) return null;

		const props =
			merge !== undefined
				? { rowSpan: merge.rowSpan, colSpan: merge.colSpan }
				: {};

		if (Tag === "th") {
			return (
				<th key={key} {...props}>
					{value ?? ""}
				</th>
			);
		}
		return (
			<td
				key={key}
				{...props}
				className={typeof value === "number" ? styles.num : undefined}
			>
				{value ?? ""}
			</td>
		);
	};

	// ─── 描画 ────────────────────────────────────────────────────────────────────

	return (
		<div className={styles.root}>
			{/* シートタブ（複数シートの場合のみ） */}
			{names.length > 1 && (
				<div className={styles.tabs}>
					{names.map(n => (
						<button
							key={n}
							type="button"
							className={`${styles.tab} ${n === active ? styles.activeTab : ""}`}
							onClick={() => setActive(n)}
						>
							{n}
						</button>
					))}
				</div>
			)}

			<div className={styles.tableWrap}>
				<table className={styles.table}>
					{/* ヘッダー */}
					<thead>
						{headerRows.map((row, hri) => {
							// sheet_to_json 上の行インデックス = hri（0-indexed）
							const hrkey = `${active}-hrow-${hri}`;
							return (
								<tr key={hrkey}>
									{/* 行番号列（左上コーナー） */}
									<th className={styles.rowNum} />

									{Array.from({ length: colCount }, (_, ci) =>
										renderCell(
											"th",
											hri, // Excel 行インデックス
											ci,
											row[ci] ?? null,
											`${active}-h${hri}-c${ci}`
										)
									)}
								</tr>
							);
						})}
					</thead>

					{/* ボディ */}
					<tbody>
						{bodyRows.map((row, bri) => {
							// sheet_to_json 上の行インデックス = headerRowCount + bri
							const excelRowIndex = headerRowCount + bri;
							return (
								<tr key={`${active}-brow-${excelRowIndex}`}>
									<td className={styles.rowNum}>{bri + 1}</td>

									{Array.from({ length: colCount }, (_, ci) =>
										renderCell(
											"td",
											excelRowIndex,
											ci,
											row[ci] ?? null,
											`${active}-r${excelRowIndex}-c${ci}`
										)
									)}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
