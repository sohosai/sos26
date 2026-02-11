import type { RowData } from "@tanstack/react-table";
import type { ZodType } from "zod";

declare module "@tanstack/react-table" {
	// biome-ignore lint/correctness/noUnusedVariables: required by module augmentation signature
	interface TableMeta<TData extends RowData> {
		updateData: (row: TData, columnId: string, value: unknown) => void;
		clearSelection?: () => void;
	}
	// biome-ignore lint/correctness/noUnusedVariables: required by module augmentation signature
	interface ColumnMeta<TData extends RowData, TValue> {
		editable?: boolean;
		type?: "text" | "number";
		options?: string[];
		schema?: ZodType;
		dateFormat?: "date" | "datetime";
		tagColors?: Record<string, string>;
	}
}
