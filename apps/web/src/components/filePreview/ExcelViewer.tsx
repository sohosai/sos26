import ExcelJS from "exceljs";
import { type CSSProperties, useEffect, useState } from "react";
import { toast } from "sonner";
import styles from "./ExcelViewer.module.scss";

type CellValue = string | number | null;

interface CellStyle {
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	fontSize?: number;
	fontColor?: string;
	bgColor?: string;
	hAlign?: string;
	vAlign?: string;
	wrapText?: boolean;
	borderTop?: string;
	borderBottom?: string;
	borderLeft?: string;
	borderRight?: string;
}

interface CellData {
	value: CellValue;
	style: CellStyle;
	rowSpan?: number;
	colSpan?: number;
}

interface ImageOverlay {
	dataUrl: string;
	left: number;
	top: number;
	width: number;
	height: number;
}

interface SheetData {
	name: string;
	rows: (CellData | null)[][];
	colWidths: number[];
	rowHeights: number[];
	images: ImageOverlay[];
}

interface Props {
	file: File;
}

interface ImageCorner {
	nativeCol?: number;
	col?: number;
	nativeRow?: number;
	row?: number;
	nativeColOff?: number;
	nativeRowOff?: number;
}

interface ImageRange {
	tl?: ImageCorner;
	br?: ImageCorner;
	ext?: {
		width: number;
		height: number;
	};
}

function toColor(color: ExcelJS.Color | undefined): string | undefined {
	if (!color) return undefined;
	if (color.argb) {
		const argb = color.argb;
		if (argb.length === 8) {
			const a = parseInt(argb.slice(0, 2), 16) / 255;
			const r = parseInt(argb.slice(2, 4), 16);
			const g = parseInt(argb.slice(4, 6), 16);
			const b = parseInt(argb.slice(6, 8), 16);
			if (a === 0) return undefined;
			return `rgba(${r},${g},${b},${a.toFixed(2)})`;
		}
		return `#${argb}`;
	}
	return undefined;
}

function toBorderStyle(border: ExcelJS.Border | undefined): string | undefined {
	if (!border?.style) return undefined;
	const styleMap: Record<string, string> = {
		thin: "1px solid",
		medium: "2px solid",
		thick: "3px solid",
		dashed: "1px dashed",
		dotted: "1px dotted",
		double: "3px double",
		hair: "1px solid",
		mediumDashed: "2px dashed",
		dashDot: "1px dashed",
		mediumDashDot: "2px dashed",
		dashDotDot: "1px dashed",
		slantDashDot: "1px dashed",
	};
	const style = styleMap[border.style] ?? "1px solid";
	const color = toColor(border.color as ExcelJS.Color) ?? "#000000";
	return `${style} ${color}`;
}

function extractStyle(cell: ExcelJS.Cell): CellStyle {
	const font = cell.font ?? {};
	const fill = cell.fill as ExcelJS.FillPattern | undefined;
	const alignment = cell.alignment ?? {};
	const border = cell.border ?? {};
	return {
		bold: font.bold,
		italic: font.italic,
		underline: !!font.underline,
		fontSize: typeof font.size === "number" ? font.size : undefined,
		fontColor: toColor(font.color as ExcelJS.Color),
		bgColor:
			fill?.type === "pattern" && fill.pattern !== "none"
				? toColor(fill.fgColor as ExcelJS.Color)
				: undefined,
		hAlign: alignment.horizontal,
		vAlign: alignment.vertical,
		wrapText: alignment.wrapText,
		borderTop: toBorderStyle(border.top as ExcelJS.Border),
		borderBottom: toBorderStyle(border.bottom as ExcelJS.Border),
		borderLeft: toBorderStyle(border.left as ExcelJS.Border),
		borderRight: toBorderStyle(border.right as ExcelJS.Border),
	};
}

function cellStyleToCSS(style: CellStyle): CSSProperties {
	return {
		fontWeight: style.bold ? "bold" : undefined,
		fontStyle: style.italic ? "italic" : undefined,
		textDecoration: style.underline ? "underline" : undefined,
		fontSize: style.fontSize ? `${style.fontSize}pt` : undefined,
		color: style.fontColor,
		backgroundColor: style.bgColor,
		textAlign: style.hAlign as CSSProperties["textAlign"],
		verticalAlign: style.vAlign as CSSProperties["verticalAlign"],
		whiteSpace: style.wrapText ? "pre-wrap" : undefined,
		borderTop: style.borderTop,
		borderBottom: style.borderBottom,
		borderLeft: style.borderLeft,
		borderRight: style.borderRight,
	};
}

// EMU → px  (914400 EMU = 1 inch = 96 px)
const EMU_PER_PX = 914400 / 96;
const emuToPx = (emu: number) => emu / EMU_PER_PX;

function buildOffsets(sizes: number[]): number[] {
	const offsets: number[] = new Array(sizes.length + 1).fill(0);
	for (let i = 1; i < sizes.length; i++) {
		offsets[i + 1] = (offsets[i] ?? 0) + (sizes[i] ?? 0);
	}
	return offsets;
}

function asImageRange(value: unknown): ImageRange | null {
	if (!value || typeof value !== "object") return null;
	return value as ImageRange;
}

function cornerToPx(
	corner: ImageCorner,
	colOffsets: number[],
	rowOffsets: number[]
): { x: number; y: number } {
	const col1 = (corner.nativeCol ?? corner.col ?? 0) + 1;
	const row1 = (corner.nativeRow ?? corner.row ?? 0) + 1;
	const colOff = corner.nativeColOff != null ? emuToPx(corner.nativeColOff) : 0;
	const rowOff = corner.nativeRowOff != null ? emuToPx(corner.nativeRowOff) : 0;

	return {
		x: (colOffsets[col1] ?? 0) + colOff,
		y: (rowOffsets[row1] ?? 0) + rowOff,
	};
}

function resolveImageOverlay(
	img: ReturnType<ExcelJS.Worksheet["getImages"]>[number],
	colWidths: number[],
	rowHeights: number[],
	dataUrl: string
): ImageOverlay | null {
	const range = asImageRange(img.range);
	const tl = range?.tl;
	if (!tl) return null;

	const colOffsets = buildOffsets(colWidths);
	const rowOffsets = buildOffsets(rowHeights);

	const tlPx = cornerToPx(tl, colOffsets, rowOffsets);
	if (range.br) {
		const brPx = cornerToPx(range.br, colOffsets, rowOffsets);
		return {
			dataUrl,
			left: tlPx.x,
			top: tlPx.y,
			width: Math.max(1, Math.abs(tlPx.x - brPx.x)),
			height: Math.max(1, Math.abs(tlPx.y - brPx.y)),
		};
	}

	if (range.ext) {
		return {
			dataUrl,
			left: tlPx.x,
			top: tlPx.y,
			width: range.ext.width,
			height: range.ext.height,
		};
	}

	return null;
}

function parseRows(ws: ExcelJS.Worksheet): (CellData | null)[][] {
	const mergeMap = new Map<string, { rowSpan: number; colSpan: number }>();
	const coveredSet = new Set<string>();
	const masterExtent = new Map<string, { maxRow: number; maxCol: number }>();

	ws.eachRow({ includeEmpty: true }, row => {
		row.eachCell({ includeEmpty: true }, cell => {
			if (!cell.isMerged) return;
			const master = cell.master;
			const key = `${master.row},${master.col}`;
			const prev = masterExtent.get(key);
			const rowIndex = Number(cell.row);
			const colIndex = Number(cell.col);
			masterExtent.set(key, {
				maxRow: Math.max(prev?.maxRow ?? rowIndex, rowIndex),
				maxCol: Math.max(prev?.maxCol ?? colIndex, colIndex),
			});
		});
	});

	for (const [key, extent] of masterExtent.entries()) {
		const [rowText, colText] = key.split(",");
		if (!rowText || !colText) continue;

		const mr = Number(rowText);
		const mc = Number(colText);
		mergeMap.set(key, {
			rowSpan: extent.maxRow - mr + 1,
			colSpan: extent.maxCol - mc + 1,
		});

		for (let r = mr; r <= extent.maxRow; r++) {
			for (let c = mc; c <= extent.maxCol; c++) {
				if (r !== mr || c !== mc) coveredSet.add(`${r},${c}`);
			}
		}
	}

	const rows: (CellData | null)[][] = [];
	ws.eachRow({ includeEmpty: true }, row => {
		const rowData: (CellData | null)[] = [];
		row.eachCell({ includeEmpty: true }, cell => {
			const key = `${cell.row},${cell.col}`;
			if (coveredSet.has(key)) {
				rowData.push(null);
				return;
			}

			let value: CellValue;
			if (cell.value == null) value = null;
			else if (typeof cell.value === "object") value = String(cell.text);
			else value = cell.value as string | number;

			const merge = mergeMap.get(key);
			rowData.push({
				value,
				style: extractStyle(cell),
				rowSpan: merge?.rowSpan,
				colSpan: merge?.colSpan,
			});
		});
		rows.push(rowData);
	});

	return rows;
}

function getColWidths(ws: ExcelJS.Worksheet): number[] {
	const colWidths: number[] = [0];
	for (const col of ws.columns) {
		colWidths.push(col?.width ? col.width * 7 : 80);
	}
	return colWidths;
}

function getRowHeights(ws: ExcelJS.Worksheet): number[] {
	const rowHeights: number[] = [0];
	ws.eachRow({ includeEmpty: true }, row => {
		rowHeights.push(row.height ? row.height * 1.33 : 20);
	});
	return rowHeights;
}

function getImageDataUrl(imgData: ExcelJS.Image): string | null {
	if (!imgData?.buffer) return null;

	const ext = (imgData.extension ?? "png").toLowerCase();
	const mimeMap: Record<string, string> = {
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		bmp: "image/bmp",
		tiff: "image/tiff",
		svg: "image/svg+xml",
	};
	const mime = mimeMap[ext] ?? "image/png";
	const bytes = new Uint8Array(imgData.buffer as ArrayBuffer);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	const base64 = btoa(binary);
	return `data:${mime};base64,${base64}`;
}

function parseSheet(ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook): SheetData {
	const rows = parseRows(ws);
	const colWidths = getColWidths(ws);
	const rowHeights = getRowHeights(ws);
	const images: ImageOverlay[] = [];

	for (const img of ws.getImages()) {
		try {
			const imgData = wb.getImage(Number(img.imageId));
			const dataUrl = imgData ? getImageDataUrl(imgData) : null;
			if (!dataUrl) continue;

			const overlay = resolveImageOverlay(img, colWidths, rowHeights, dataUrl);
			if (overlay) images.push(overlay);
		} catch {
			toast.error("ファイル内の画像の読み込みに失敗しました。");
		}
	}

	return { name: ws.name, rows, colWidths, rowHeights, images };
}

export default function ExcelViewer({ file }: Props) {
	const [sheets, setSheets] = useState<SheetData[]>([]);
	const [active, setActive] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			setIsLoading(true);
			setErrorMessage(null);
			try {
				const buf = await file.arrayBuffer();
				const wb = new ExcelJS.Workbook();
				await wb.xlsx.load(buf);
				const parsed = wb.worksheets.map(ws => parseSheet(ws, wb));

				if (!cancelled) {
					setSheets(parsed);
					setActive(0);
				}
			} catch {
				if (!cancelled) {
					setSheets([]);
					setActive(0);
					setErrorMessage("Excelファイルの読み込みに失敗しました。");
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		};
		load();
		return () => {
			cancelled = true;
		};
	}, [file]);

	const sheet = sheets[active];
	const rows = sheet?.rows ?? [];
	const colWidths = sheet?.colWidths ?? [];
	const rowHeights = sheet?.rowHeights ?? [];
	const images = sheet?.images ?? [];
	const colCount = Math.max(0, ...rows.map(r => r.length));

	return (
		<div className={styles.viewer}>
			{isLoading && (
				<p className={styles.status}>Excelファイルを読み込み中です...</p>
			)}
			{errorMessage && <p className={styles.status}>{errorMessage}</p>}
			{/* Sheet tabs */}
			{sheets.length > 1 && (
				<div className={styles.tabs}>
					{sheets.map((s, i) => (
						<button
							type="button"
							key={`${s.name}-${i}`}
							className={`${styles.tab} ${i === active ? styles.activeTab : ""}`}
							onClick={() => setActive(i)}
						>
							{s.name}
						</button>
					))}
				</div>
			)}

			<div className={styles.tableWrapper}>
				<div style={{ position: "relative", display: "inline-block" }}>
					<table className={styles.table}>
						<colgroup>
							{Array.from({ length: colCount }, (_, ci) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>表示専用で並び順が変わらないため
								<col key={ci} style={{ width: colWidths[ci + 1] ?? 80 }} />
							))}
						</colgroup>
						<tbody>
							{rows.map((row, ri) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>表示専用で並び順が変わらないため
								<tr key={ri} style={{ height: rowHeights[ri + 1] ?? 20 }}>
									{row.map((cell, ci) => {
										if (cell === null) return null;
										return (
											<td
												// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>表示専用で並び順が変わらないため
												key={`cell-${ri}-${ci}`}
												rowSpan={cell.rowSpan}
												colSpan={cell.colSpan}
												style={{
													...cellStyleToCSS(cell.style),
													padding: "2px 4px",
													overflow: "hidden",
												}}
											>
												{cell.value ?? ""}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>

					{/* Image / drawing overlays */}
					{images.map((img, i) => (
						<img
							key={`img-${i}-${img.left}-${img.top}`}
							src={img.dataUrl}
							alt={`drawing-${i}`}
							style={{
								zIndex: 1000,
								position: "absolute",
								left: img.left,
								top: img.top,
								width: img.width,
								height: "auto",
								pointerEvents: "none",
							}}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
