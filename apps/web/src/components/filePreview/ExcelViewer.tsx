import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import styles from "./ExcelViewer.module.scss";

type Row = (string | number | boolean | null)[];

interface Props {
	file: File;
}

export default function ExcelViewer({ file }: Props) {
	const [sheets, setSheets] = useState<Record<string, Row[]>>({});
	const [names, setNames] = useState<string[]>([]);
	const [active, setActive] = useState("");

	useEffect(() => {
		file.arrayBuffer().then(buf => {
			const wb = XLSX.read(buf, { type: "array" });
			const parsed: Record<string, Row[]> = {};
			for (const name of wb.SheetNames) {
				const sheet = wb.Sheets[name];
				if (sheet) {
					parsed[name] = XLSX.utils.sheet_to_json<Row>(sheet, {
						header: 1,
						defval: null,
					});
				}
			}
			setSheets(parsed);
			setNames(wb.SheetNames);
			setActive(wb.SheetNames[0] ?? "");
		});
	}, [file]);

	const sheetKey = active;
	const rows = sheets[active] ?? [];
	const headers = rows[0] ?? [];
	const body = rows.slice(1);

	return (
		<div className={styles.root}>
			{names.length > 1 && (
				<div className={styles.tabs}>
					{names.map(n => (
						<button
							key={n}
							className={`${styles.tab} ${n === active ? styles.activeTab : ""}`}
							type="button"
							onClick={() => setActive(n)}
						>
							{n}
						</button>
					))}
				</div>
			)}
			<div className={styles.tableWrap}>
				<table className={styles.table}>
					<thead>
						<tr>
							<th className={styles.rowNum} />
							{headers.map((h, ci) => (
								<th key={`${sheetKey}-col-${ci}-${String(h)}`}>{h ?? ""}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{body.map((row, ri) => {
							const rowKey = `${sheetKey}-row-${ri + 1}`;
							return (
								<tr key={rowKey}>
									<td className={styles.rowNum}>{ri + 1}</td>
									{headers.map((_, ci) => {
										const v = row[ci];
										const cellKey = `${sheetKey}-r${ri + 1}-c${ci}`;
										return (
											<td
												key={cellKey}
												className={typeof v === "number" ? styles.num : ""}
											>
												{v ?? ""}
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
