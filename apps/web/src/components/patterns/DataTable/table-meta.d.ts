import type { RowData } from "@tanstack/react-table";
import type { FormItemType } from "@sos26/shared";
import type { ZodType } from "zod";

declare module "@tanstack/react-table" {
	interface TableMeta<TData extends RowData> {
		updateData: (row: TData, columnId: string, value: unknown) => void;
		clearSelection?: () => void;
	}
	interface ColumnMeta<TData extends RowData, TValue> {
		editable?: boolean;
		type?: "text" | "number";
		options?: string[];
		/** select/multi-select 用構造化オプション（value=ID, label=表示名） */
		selectOptions?: { value: string; label: string }[];
		schema?: ZodType;
		dateFormat?: "date" | "datetime";
		tagColors?: Record<string, string>;
		/** カラムフィルターの種別（columnFilter=true 時に表示） */
		filterVariant?: "text" | "number" | "select";
		/** FORM_ITEM カラムのフォーム項目タイプ（FormItemCell 内の型判定用） */
		formItemType?: FormItemType;
	}
}
