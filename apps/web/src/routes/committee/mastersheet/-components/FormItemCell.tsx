import { Flex, Link, Text } from "@radix-ui/themes";
import type { MastersheetCellStatus } from "@sos26/shared";
import type { CellContext, RowData } from "@tanstack/react-table";
import { FormCellStatusBadge } from "@/components/patterns/DataTable/cells/FormCellStatusBadge";

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

export function FormItemCell<TData extends RowData>({
	getValue,
	column,
}: CellContext<TData, unknown>) {
	const cell = getValue() as CellData | null | undefined;
	const formItemType = column.columnDef.meta?.formItemType;

	if (!cell || !cell.status || cell.status === "NOT_DELIVERED") {
		return (
			<Text color="gray" size="2">
				─
			</Text>
		);
	}

	if (cell.status === "NOT_ANSWERED") {
		return <FormCellStatusBadge status={cell.status} />;
	}

	const effectiveValue = cell.override ?? cell.formValue ?? null;
	const displayText = getDisplayText(effectiveValue, formItemType);

	if (cell.status === "SUBMITTED") {
		if (formItemType === "FILE" && displayText) {
			return (
				<Link href={displayText} target="_blank" size="2">
					ファイル
				</Link>
			);
		}
		return (
			<Text size="2" truncate>
				{displayText ?? "─"}
			</Text>
		);
	}

	// DRAFT / OVERRIDDEN / STALE_OVERRIDE
	const isDraft = cell.status === "DRAFT";

	return (
		<Flex gap="1" align="center">
			<Text size="2" color={isDraft ? "gray" : undefined} truncate>
				{displayText ?? "─"}
			</Text>
			<FormCellStatusBadge status={cell.status} />
		</Flex>
	);
}
