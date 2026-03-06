import { Link, Text } from "@radix-ui/themes";
import type { MastersheetCellStatus } from "@sos26/shared";
import type { CellContext, RowData } from "@tanstack/react-table";
import { useCallback, useEffect, useRef, useState } from "react";
import editableStyles from "@/components/patterns/DataTable/cells/EditableCell.module.scss";
import styles from "./FormItemCell.module.scss";

// ─────────────────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────────────────

type CellValue = {
	textValue: string | null;
	numberValue: number | null;
	fileUrl: string | null;
	selectedOptionIds: string[];
};

type CellData = {
	columnId: string;
	status?: MastersheetCellStatus;
	formValue?: CellValue | null;
	cellValue?: CellValue | null;
};

// TEXT / TEXTAREA / NUMBER のみインライン編集可能
const EDITABLE_TYPES = new Set(["TEXT", "TEXTAREA", "NUMBER"]);

function getDisplayText(
	value: CellValue | null | undefined,
	formItemType: string | undefined
): string | null {
	if (!value) return null;
	if (formItemType === "NUMBER") {
		return value.numberValue != null ? String(value.numberValue) : null;
	}
	if (formItemType === "FILE") {
		return value.fileUrl;
	}
	return value.textValue;
}

// ─────────────────────────────────────────────────────────────
// 常時レンダリングの編集 input（レイアウトシフト防止）
// ─────────────────────────────────────────────────────────────

type FormEditableCellProps = {
	initialText: string;
	isNumberType: boolean;
	onCommit: (value: string) => void;
	onStartEdit: () => void;
};

function FormEditableCell({
	initialText,
	isNumberType,
	onCommit,
	onStartEdit,
}: FormEditableCellProps) {
	const [value, setValue] = useState(initialText);
	const inputRef = useRef<HTMLInputElement>(null);
	const isEditingRef = useRef(false);
	const [, rerender] = useState(0);
	const [isFocused, setIsFocused] = useState(false);

	const setIsEditing = useCallback((editing: boolean) => {
		isEditingRef.current = editing;
		rerender(c => c + 1);
	}, []);

	useEffect(() => {
		setValue(initialText);
	}, [initialText]);

	function commit() {
		setIsEditing(false);
		setIsFocused(false);
		onCommit(value);
	}

	return (
		<div className={editableStyles.wrapper}>
			<input
				ref={inputRef}
				className={`${editableStyles.input} ${styles.input}`}
				inputMode={isNumberType ? "numeric" : undefined}
				value={value}
				placeholder="─"
				size={Math.max(value.length, 1)}
				data-editing={isEditingRef.current}
				data-focused={isFocused}
				onChange={e => {
					if (isEditingRef.current) {
						setValue(e.target.value);
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
					onStartEdit();
					setIsEditing(true);
					inputRef.current?.focus();
				}}
				onBlur={() => {
					if (isEditingRef.current) {
						commit();
					} else {
						setIsFocused(false);
					}
				}}
				onKeyDown={e => {
					if (e.nativeEvent.isComposing) return;
					if (e.key === "Escape") {
						setValue(initialText);
						setIsEditing(false);
						inputRef.current?.blur();
					} else if (e.key === "Enter") {
						e.preventDefault();
						commit();
						inputRef.current?.blur();
					} else if (
						!isEditingRef.current &&
						e.key.length === 1 &&
						!e.ctrlKey &&
						!e.metaKey
					) {
						onStartEdit();
						setIsEditing(true);
						setValue("");
					}
				}}
			/>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────

export function FormItemCell<TData extends RowData>({
	getValue,
	row,
	column,
	table,
}: CellContext<TData, unknown>) {
	const cell = getValue() as CellData | null | undefined;
	const formItemType = column.columnDef.meta?.formItemType;
	const isEditable = !!formItemType && EDITABLE_TYPES.has(formItemType);
	const isNumberType = formItemType === "NUMBER";

	if (!cell || !cell.status || cell.status === "NOT_DELIVERED") {
		return (
			<Text color="gray" size="2">
				─
			</Text>
		);
	}

	const effectiveValue = cell.formValue ?? null;
	const displayText = getDisplayText(effectiveValue, formItemType);
	// ファイル型は Link 表示のみ（編集不可）
	// URL なしの場合は下の !isEditable ブランチで「─」を表示
	if (formItemType === "FILE" && displayText) {
		return (
			<Link href={displayText} target="_blank" size="2">
				ファイル
			</Link>
		);
	}

	// 編集不可（FILE型等）はテキスト表示のみ
	if (!isEditable) {
		return (
			<Text size="2" truncate>
				{displayText ?? "─"}
			</Text>
		);
	}

	// TEXT / TEXTAREA / NUMBER: 常時レンダリング input で編集
	const initialText = isNumberType
		? (effectiveValue?.numberValue?.toString() ?? "")
		: (effectiveValue?.textValue ?? "");

	function handleCommit(value: string) {
		const committed = isNumberType ? Number(value) : value;
		table.options.meta?.updateData(row.original, column.id, committed);
	}

	function handleStartEdit() {
		table.options.meta?.clearSelection?.();
	}

	return (
		<FormEditableCell
			initialText={initialText}
			isNumberType={isNumberType}
			onCommit={handleCommit}
			onStartEdit={handleStartEdit}
		/>
	);
}
