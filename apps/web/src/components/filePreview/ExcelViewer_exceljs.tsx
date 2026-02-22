import ExcelJS from "exceljs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import styles from "./ExcelViewer_exceljs.module.scss";

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

function cellStyleToCSS(style: CellStyle): React.CSSProperties {
	return {
		fontWeight: style.bold ? "bold" : undefined,
		fontStyle: style.italic ? "italic" : undefined,
		textDecoration: style.underline ? "underline" : undefined,
		fontSize: style.fontSize ? `${style.fontSize}pt` : undefined,
		color: style.fontColor,
		backgroundColor: style.bgColor,
		textAlign: style.hAlign as React.CSSProperties["textAlign"],
		verticalAlign: style.vAlign as React.CSSProperties["verticalAlign"],
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
		const prev = offsets[i] ?? 0;
		offsets[i + 1] = prev + (sizes[i] ?? 0);
	}
	return offsets;
}

function resolveImageOverlay(
	img: ReturnType<ExcelJS.Worksheet["getImages"]>[number],
	colWidths: number[],
	rowHeights: number[],
	dataUrl: string
): ImageOverlay | null {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const range = img.range as any;
	// console.log(range);
	const tl = range?.tl;
	if (!tl) return null;

	const colOffsets = buildOffsets(colWidths);
	// console.log(colOffsets);
	const rowOffsets = buildOffsets(rowHeights);

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	function cornerToPx(corner: any): { x: number; y: number } {
		const col1 = (corner.nativeCol ?? corner.col ?? 0) + 1;
		const row1 = (corner.nativeRow ?? corner.row ?? 0) + 1;
		const colOff =
			corner.nativeColOff != null ? emuToPx(corner.nativeColOff) : 0;
		const rowOff =
			corner.nativeRowOff != null ? emuToPx(corner.nativeRowOff) : 0;

		const colOffsetsSum = colOffsets.reduce((acc, value, index) => {
			return index < col1 ? acc + value : acc;
		}, 0);
		return {
			// 大きさの変換がよくわかんないが、これが安定している。上で、二重で合計を取ろうとしていたりするため、確実に正しくはないと思う
			x: (colOffsetsSum ?? 0) + colOff,
			// y: (rowOffsetsSum ?? 0) + rowOff,
			// x: (colOffsets[col1] ?? 0) + colOff,
			y: (rowOffsets[row1] ?? 0) + rowOff,
		};
	}

	const tlPx = cornerToPx(tl);

	const br = range?.br;
	if (br) {
		const brPx = cornerToPx(br);
		return {
			dataUrl,
			left: tlPx.x,
			top: tlPx.y,
			width: Math.max(1, Math.abs(tlPx.x - brPx.x)),
			height: Math.max(1, Math.abs(tlPx.y - brPx.y)),
		};
	}

	const ext = range?.ext;
	if (ext) {
		return {
			dataUrl,
			left: tlPx.x,
			top: tlPx.y,
			width: ext.width,
			height: ext.height,
		};
	}

	return null;
}

export default function ExcelViewer_exceljs({ file }: Props) {
	const [sheets, setSheets] = useState<SheetData[]>([]);
	const [active, setActive] = useState(0);

	useEffect(() => {
		const load = async () => {
			const buf = await file.arrayBuffer();
			const wb = new ExcelJS.Workbook();
			await wb.xlsx.load(buf);

			// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
			const parsed: SheetData[] = wb.worksheets.map(ws => {
				const mergeMap = new Map<
					string,
					{ rowSpan: number; colSpan: number }
				>();
				const coveredSet = new Set<string>();
				const masterExtent = new Map<
					string,
					{ maxRow: number; maxCol: number }
				>();

				ws.eachRow({ includeEmpty: true }, row => {
					row.eachCell({ includeEmpty: true }, cell => {
						if (!cell.isMerged) return;
						const master = cell.master;
						const key = `${master.row},${master.col}`;
						const prev = masterExtent.get(key);
						const row = Number(cell.row);
						const col = Number(cell.col);
						masterExtent.set(key, {
							maxRow: Math.max(prev?.maxRow ?? row, row),
							maxCol: Math.max(prev?.maxCol ?? col, col),
						});
					});
				});

				for (const [key, extent] of masterExtent.entries()) {
					const parts = key.split(",");
					if (parts.length !== 2) continue;

					const mr = Number(parts[0]);
					const mc = Number(parts[1]);
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
					// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
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

				const colWidths: number[] = [0];
				// biome-ignore lint/suspicious/useIterableCallbackReturn: <explanation>
				ws.columns.forEach(col =>
					colWidths.push(col?.width ? col.width * 7 : 80)
				);

				const rowHeights: number[] = [0];
				ws.eachRow({ includeEmpty: true }, row =>
					rowHeights.push(row.height ? row.height * 1.33 : 20)
				);

				const images: ImageOverlay[] = [];

				for (const img of ws.getImages()) {
					try {
						const imgData = wb.getImage(img.imageId as unknown as number);
						// console.log(imgData);
						if (!imgData?.buffer) continue;

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
						const dataUrl = `data:${mime};base64,${base64}`;

						const overlay = resolveImageOverlay(
							img,
							colWidths,
							rowHeights,
							dataUrl
						);
						// console.log(overlay);
						if (overlay) images.push(overlay);
					} catch {
						toast.error("ファイル内の画像の読み込みに失敗しました。");
					}
				}

				return { name: ws.name, rows, colWidths, rowHeights, images };
			});

			setSheets(parsed);
			setActive(0);
		};
		load();
	}, [file]);

	const sheet = sheets[active];
	const rows = sheet?.rows ?? [];
	const colWidths = sheet?.colWidths ?? [];
	const rowHeights = sheet?.rowHeights ?? [];
	const images = sheet?.images ?? [];
	// console.log(sheet);
	// console.log(images);
	const colCount = Math.max(0, ...rows.map(r => r.length));

	return (
		<div className={styles.viewer}>
			{/* Sheet tabs */}
			{sheets.length > 1 && (
				<div className={styles.tabs}>
					{sheets.map((s, i) => (
						<button
							type="button"
							// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
							key={i}
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
								// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
								<col key={ci} style={{ width: colWidths[ci + 1] ?? 80 }} />
							))}
						</colgroup>
						<tbody>
							{rows.map((row, ri) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
								<tr key={ri} style={{ height: rowHeights[ri + 1] ?? 20 }}>
									{row.map((cell, ci) => {
										if (cell === null) return null;
										return (
											<td
												// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
												key={ci}
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
							// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
							key={i}
							src={img.dataUrl}
							alt={`drawing-${i}`}
							style={{
								zIndex: 1000,
								position: "absolute",
								left: img.left,
								top: img.top,
								width: img.width,
								height: "auto",
								pointerEvents: "none", // don't block table interactions
							}}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
