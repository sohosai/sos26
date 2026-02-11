import type { CellContext, RowData } from "@tanstack/react-table";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./EditableCell.module.scss";

export function EditableCell<TData extends RowData>({
	getValue,
	row,
	column,
	table,
}: CellContext<TData, unknown>) {
	const initialValue = getValue();
	const [value, setValue] = useState(initialValue);
	const [validationError, setValidationError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const editable = column.columnDef.meta?.editable ?? false;
	const inputType = column.columnDef.meta?.type ?? "text";
	const schema = column.columnDef.meta?.schema;
	const isEditingRef = useRef(false);
	const [, rerender] = useState(0);

	const setIsEditing = useCallback((editing: boolean) => {
		isEditingRef.current = editing;
		rerender(c => c + 1);
	}, []);

	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

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
		setIsFocused(false);
		table.options.meta?.updateData(row.original, column.id, committed);
		return true;
	};

	return (
		<div className={styles.wrapper}>
			<input
				ref={inputRef}
				className={styles.input}
				inputMode={inputType === "number" ? "numeric" : undefined}
				value={String(value)}
				size={Math.max(String(value).length, 1)}
				data-editing={isEditingRef.current}
				data-focused={isFocused}
				data-error={!!validationError}
				onChange={e => {
					if (isEditingRef.current) {
						setValue(e.target.value);
						setValidationError(null);
					}
				}}
				onMouseDown={e => {
					if (!isEditingRef.current) {
						e.preventDefault();
						inputRef.current?.focus();
					}
				}}
				onFocus={() => setIsFocused(true)}
				onDoubleClick={() => {
					if (editable) {
						table.options.meta?.clearSelection?.();
						setIsEditing(true);
						inputRef.current?.focus();
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
						inputRef.current?.blur();
					} else if (e.key === "Enter") {
						e.preventDefault();
						if (commitValue()) {
							inputRef.current?.blur();
						}
					} else if (
						!isEditingRef.current &&
						editable &&
						e.key.length === 1 &&
						!e.ctrlKey &&
						!e.metaKey
					) {
						table.options.meta?.clearSelection?.();
						setIsEditing(true);
						setValue("");
					}
				}}
			/>
			{validationError && (
				<div className={styles.errorMessage}>{validationError}</div>
			)}
		</div>
	);
}
