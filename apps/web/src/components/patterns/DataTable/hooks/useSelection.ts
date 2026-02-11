import { useCallback, useRef, useState } from "react";

export type CellId = `${number}:${number}`;

type CellCoord = { row: number; col: number };

function makeCellId(row: number, col: number): CellId {
	return `${row}:${col}`;
}

function getRectCells(a: CellCoord, b: CellCoord): Set<CellId> {
	const minRow = Math.min(a.row, b.row);
	const maxRow = Math.max(a.row, b.row);
	const minCol = Math.min(a.col, b.col);
	const maxCol = Math.max(a.col, b.col);

	const cells = new Set<CellId>();
	for (let r = minRow; r <= maxRow; r++) {
		for (let c = minCol; c <= maxCol; c++) {
			cells.add(makeCellId(r, c));
		}
	}
	return cells;
}

export function useSelection() {
	const [selected, setSelected] = useState<Set<CellId>>(new Set());
	const anchorRef = useRef<CellCoord | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const baseSelectionRef = useRef<Set<CellId>>(new Set());

	const isSelected = useCallback(
		(row: number, col: number) => selected.has(makeCellId(row, col)),
		[selected]
	);

	const clearSelection = useCallback(() => {
		setSelected(new Set());
		anchorRef.current = null;
	}, []);

	const handleCellMouseDown = useCallback(
		(row: number, col: number, e: React.MouseEvent) => {
			const coord: CellCoord = { row, col };
			const cellId = makeCellId(row, col);

			if (e.shiftKey && anchorRef.current) {
				// Shift+click: rectangular range from anchor
				const rect = getRectCells(anchorRef.current, coord);
				setSelected(rect);
				setIsDragging(true);
				baseSelectionRef.current = new Set();
			} else if (e.ctrlKey || e.metaKey) {
				// Ctrl/Cmd+click: toggle cell, then allow drag to extend range
				setSelected(prev => {
					const next = new Set(prev);
					if (next.has(cellId)) {
						next.delete(cellId);
					} else {
						next.add(cellId);
					}
					baseSelectionRef.current = next;
					return next;
				});
				anchorRef.current = coord;
				setIsDragging(true);
			} else {
				// Normal click: single cell
				setSelected(new Set([cellId]));
				anchorRef.current = coord;
				setIsDragging(true);
				baseSelectionRef.current = new Set();
			}
		},
		[]
	);

	const handleCellMouseEnter = useCallback(
		(row: number, col: number) => {
			if (!isDragging || !anchorRef.current) return;
			const coord: CellCoord = { row, col };
			const rect = getRectCells(anchorRef.current, coord);
			const merged = new Set([...baseSelectionRef.current, ...rect]);
			setSelected(merged);
		},
		[isDragging]
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	return {
		selected,
		isDragging,
		isSelected,
		clearSelection,
		handleCellMouseDown,
		handleCellMouseEnter,
		handleMouseUp,
	};
}
