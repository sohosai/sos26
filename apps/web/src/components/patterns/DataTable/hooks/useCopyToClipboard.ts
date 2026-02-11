import type { RowData, Table } from "@tanstack/react-table";
import { useEffect } from "react";
import type { CellId } from "./useSelection";

function parseCellIds(selected: Set<CellId>): Map<number, Set<number>> {
	const rowCols = new Map<number, Set<number>>();
	for (const cellId of selected) {
		const sep = cellId.indexOf(":");
		const row = Number(cellId.slice(0, sep));
		const col = Number(cellId.slice(sep + 1));
		let colSet = rowCols.get(row);
		if (!colSet) {
			colSet = new Set();
			rowCols.set(row, colSet);
		}
		colSet.add(col);
	}
	return rowCols;
}

function collectColumnIndices(rowCols: Map<number, Set<number>>): number[] {
	const allCols = new Set<number>();
	for (const cols of rowCols.values()) {
		for (const c of cols) allCols.add(c);
	}
	return [...allCols].sort((a, b) => a - b);
}

function buildTsv<TData extends RowData>(
	table: Table<TData>,
	rowCols: Map<number, Set<number>>,
	selectedColIndices: number[]
): string {
	const visibleColumns = table.getVisibleLeafColumns();
	const rows = table.getRowModel().rows;
	const lines: string[] = [];
	for (let i = 0; i < rows.length; i++) {
		const cols = rowCols.get(i);
		if (!cols) continue;
		const values = selectedColIndices.map(colIdx =>
			cols.has(colIdx)
				? String(rows[i]?.getValue(visibleColumns[colIdx]?.id ?? "") ?? "")
				: ""
		);
		lines.push(values.join("\t"));
	}
	return lines.join("\n");
}

function hasNativeTextSelection(): boolean {
	const active = document.activeElement;
	if (
		active instanceof HTMLInputElement ||
		active instanceof HTMLTextAreaElement
	) {
		const { selectionStart, selectionEnd } = active;
		return (
			selectionStart !== null &&
			selectionEnd !== null &&
			selectionStart !== selectionEnd
		);
	}
	return false;
}

export function useCopyToClipboard<TData extends RowData>(
	table: Table<TData>,
	selected: Set<CellId>,
	enabled: boolean = true
) {
	useEffect(() => {
		if (!enabled) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!((e.ctrlKey || e.metaKey) && e.key === "c")) return;
			if (selected.size === 0) return;
			if (hasNativeTextSelection()) return;

			e.preventDefault();

			const rowCols = parseCellIds(selected);
			const selectedColIndices = collectColumnIndices(rowCols);
			const tsv = buildTsv(table, rowCols, selectedColIndices);

			navigator.clipboard.writeText(tsv).catch(() => {});
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [table, selected, enabled]);
}
