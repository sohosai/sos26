import { Link, Text } from "@radix-ui/themes";
import type { MastersheetCellStatus } from "@sos26/shared";
import type { CellContext, RowData } from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import editableStyles from "@/components/patterns/DataTable/cells/EditableCell.module.scss";

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
	override?: (CellValue & { isStale: boolean }) | null;
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
// 編集入力コンポーネント
// ─────────────────────────────────────────────────────────────

type EditInputProps = {
	initialValue: string;
	isNumberType: boolean;
	onCommit: (value: string) => void;
	onCancel: () => void;
};

function EditInput({
	initialValue,
	isNumberType,
	onCommit,
	onCancel,
}: EditInputProps) {
	const [value, setValue] = useState(initialValue);
	const inputRef = useRef<HTMLInputElement>(null);
	const committedRef = useRef(false);

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	function handleCommit() {
		if (committedRef.current) return;
		committedRef.current = true;
		onCommit(value);
	}

	return (
		<div className={editableStyles.wrapper}>
			<input
				ref={inputRef}
				className={editableStyles.input}
				inputMode={isNumberType ? "numeric" : undefined}
				value={value}
				size={Math.max(value.length, 1)}
				data-editing={true}
				onChange={e => setValue(e.target.value)}
				onBlur={handleCommit}
				onKeyDown={e => {
					if (e.nativeEvent.isComposing) return;
					if (e.key === "Escape") {
						e.preventDefault();
						onCancel();
					} else if (e.key === "Enter") {
						e.preventDefault();
						handleCommit();
					}
				}}
			/>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// 表示コンポーネント
// ─────────────────────────────────────────────────────────────

type CellDisplayProps = {
	cell: Omit<CellData, "status"> & { status: MastersheetCellStatus };
	formItemType: string | undefined;
	canEdit: boolean;
	onDoubleClick: () => void;
};

function CellDisplay({
	cell,
	formItemType,
	canEdit,
	onDoubleClick,
}: CellDisplayProps) {
	const handler = canEdit ? onDoubleClick : undefined;
	const effectiveValue = cell.override ?? cell.formValue ?? null;
	const displayText = getDisplayText(effectiveValue, formItemType);

	// 未回答 → ─
	if (cell.status === "NOT_ANSWERED") {
		return (
			<Text size="2" color="gray" onDoubleClick={handler}>
				─
			</Text>
		);
	}

	// 下書き → グレーテキスト
	if (cell.status === "DRAFT") {
		return (
			<Text size="2" color="gray" truncate onDoubleClick={handler}>
				{displayText ?? "─"}
			</Text>
		);
	}

	// SUBMITTED / OVERRIDDEN / STALE_OVERRIDE → 値のみ
	if (formItemType === "FILE" && displayText) {
		return (
			<Link href={displayText} target="_blank" size="2">
				ファイル
			</Link>
		);
	}
	return (
		<Text size="2" truncate onDoubleClick={handler}>
			{displayText ?? "─"}
		</Text>
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
	const [isEditing, setIsEditing] = useState(false);

	if (!cell || !cell.status || cell.status === "NOT_DELIVERED") {
		return (
			<Text color="gray" size="2">
				─
			</Text>
		);
	}

	const effectiveValue = cell.override ?? cell.formValue ?? null;
	const initialText = isNumberType
		? (effectiveValue?.numberValue?.toString() ?? "")
		: (effectiveValue?.textValue ?? "");

	function handleCommit(value: string) {
		const committed = isNumberType ? Number(value) : value;
		setIsEditing(false);
		table.options.meta?.updateData(row.original, column.id, committed);
	}

	function handleCancel() {
		setIsEditing(false);
	}

	function handleDoubleClick() {
		table.options.meta?.clearSelection?.();
		setIsEditing(true);
	}

	if (isEditing) {
		return (
			<EditInput
				initialValue={initialText}
				isNumberType={isNumberType}
				onCommit={handleCommit}
				onCancel={handleCancel}
			/>
		);
	}

	return (
		<CellDisplay
			// cell.status は上の早期 return で undefined / NOT_DELIVERED が除外済み
			cell={cell as CellDisplayProps["cell"]}
			formItemType={formItemType}
			canEdit={isEditable}
			onDoubleClick={handleDoubleClick}
		/>
	);
}
