import type { CellContext, RowData } from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import type { ZodType } from "zod";

declare module "@tanstack/react-table" {
	// biome-ignore lint/correctness/noUnusedVariables: required by module augmentation signature
	interface TableMeta<TData extends RowData> {
		updateData: (rowIndex: number, columnId: string, value: unknown) => void;
		clearSelection?: () => void;
	}
	// biome-ignore lint/correctness/noUnusedVariables: required by module augmentation signature
	interface ColumnMeta<TData extends RowData, TValue> {
		editable?: boolean;
		type?: "text" | "number";
		options?: string[];
		schema?: ZodType;
	}
}

export function EditableCell<TData extends RowData>({
	getValue,
	row,
	column,
	table,
}: CellContext<TData, unknown>) {
	const initialValue = getValue();
	const [value, setValue] = useState(initialValue);
	const [isEditing, setIsEditing] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const editable = column.columnDef.meta?.editable ?? false;
	const inputType = column.columnDef.meta?.type ?? "text";
	const schema = column.columnDef.meta?.schema;
	const isEditingRef = useRef(false);

	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	useEffect(() => {
		if (isEditing) {
			inputRef.current?.focus();
		}
	}, [isEditing]);

	const [isFocused, setIsFocused] = useState(false);

	const commitValue = (): boolean => {
		const committed = inputType === "number" ? Number(value) : value;

		if (schema) {
			const result = schema.safeParse(committed);
			if (!result.success) {
				const firstIssue = result.error.issues[0];
				if (firstIssue) {
					setValidationError(firstIssue.message);
				}
				return false;
			}
		}

		setValidationError(null);
		setIsEditing(false);
		isEditingRef.current = false;
		setIsFocused(false);
		table.options.meta?.updateData(row.index, column.id, committed);
		return true;
	};

	return (
		<div style={{ position: "relative" }}>
			<input
				ref={inputRef}
				inputMode={inputType === "number" ? "numeric" : undefined}
				value={value as string}
				size={Math.max(String(value).length, 1)}
				onChange={e => {
					if (isEditingRef.current) {
						setValue(e.target.value);
						setValidationError(null);
					}
				}}
				onMouseDown={e => {
					if (!isEditing) {
						e.preventDefault();
						inputRef.current?.focus();
					}
				}}
				onFocus={() => setIsFocused(true)}
				onDoubleClick={() => {
					if (editable) {
						table.options.meta?.clearSelection?.();
						setIsEditing(true);
						isEditingRef.current = true;
					}
				}}
				onBlur={() => {
					if (isEditingRef.current) {
						if (!commitValue()) {
							requestAnimationFrame(() => inputRef.current?.focus());
						}
					} else {
						setIsFocused(false);
					}
				}}
				onKeyDown={e => {
					if (e.nativeEvent.isComposing) return;
					if (e.key === "Escape") {
						setValue(initialValue);
						setValidationError(null);
						setIsEditing(false);
						isEditingRef.current = false;
						inputRef.current?.blur();
					} else if (e.key === "Enter") {
						e.preventDefault();
						if (commitValue()) {
							inputRef.current?.blur();
						}
					} else if (
						!isEditing &&
						editable &&
						e.key.length === 1 &&
						!e.ctrlKey &&
						!e.metaKey
					) {
						table.options.meta?.clearSelection?.();
						setIsEditing(true);
						isEditingRef.current = true;
						setValue("");
					}
				}}
				style={{
					all: "unset",
					display: "block",
					width: "100%",
					padding: "var(--table-cell-padding)",
					margin: "calc(var(--table-cell-padding) * -1)",
					cursor: isEditing ? "text" : "default",
					caretColor: isEditing ? undefined : "transparent",
					userSelect: isEditing ? undefined : "none",
					boxShadow: isFocused
						? isEditing
							? validationError
								? "inset 0 0 0 2px var(--red-9)"
								: "inset 0 0 0 2px var(--accent-9)"
							: "inset 0 0 0 2px var(--accent-7)"
						: undefined,
				}}
			/>
			{validationError && (
				<div
					style={{
						position: "absolute",
						left: 0,
						top: "100%",
						fontSize: "11px",
						lineHeight: 1.2,
						color: "var(--red-11)",
						padding: "2px 4px",
						whiteSpace: "nowrap",
						zIndex: 10,
					}}
				>
					{validationError}
				</div>
			)}
		</div>
	);
}
