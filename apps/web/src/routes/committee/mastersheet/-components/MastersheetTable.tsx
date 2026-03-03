import { Text } from "@radix-ui/themes";
import type {
	GetMastersheetDataResponse,
	UpsertMastersheetCellRequest,
} from "@sos26/shared";
import { useRouter } from "@tanstack/react-router";
import {
	type ColumnDef,
	createColumnHelper,
	type SortingState,
	type VisibilityState,
} from "@tanstack/react-table";
import { type ReactNode, useMemo } from "react";
import {
	DataTable,
	EditableCell,
	MultiSelectCell,
	SelectCell,
} from "@/components/patterns";
import {
	upsertMastersheetCell,
	upsertMastersheetOverride,
} from "@/lib/api/committee-mastersheet";
import { FormItemCell } from "./FormItemCell";

type MastersheetRow = {
	project: GetMastersheetDataResponse["rows"][number]["project"];
	cells: Record<
		string,
		GetMastersheetDataResponse["rows"][number]["cells"][number]
	>;
};

type ApiColumn = GetMastersheetDataResponse["columns"][number];

type Props = {
	columns: GetMastersheetDataResponse["columns"];
	rows: GetMastersheetDataResponse["rows"];
	toolbarExtra?: ReactNode;
	initialSorting?: SortingState;
	initialColumnVisibility?: VisibilityState;
	onSortingChange?: (sorting: SortingState) => void;
	onColumnVisibilityChange?: (visibility: VisibilityState) => void;
};

const columnHelper = createColumnHelper<MastersheetRow>();

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table requires any for mixed column value types
const fixedColumns: ColumnDef<MastersheetRow, any>[] = [
	columnHelper.accessor(row => row.project.number, {
		id: "number",
		header: "企画番号",
		cell: ctx => (
			<Text size="2" weight="medium">
				{ctx.getValue() as number}
			</Text>
		),
	}),
	columnHelper.accessor(row => row.project.name, {
		id: "name",
		header: "企画名",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
	}),
	columnHelper.accessor(row => row.project.type, {
		id: "type",
		header: "種別",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
	}),
	columnHelper.accessor(row => row.project.organizationName, {
		id: "organizationName",
		header: "団体名",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
	}),
	columnHelper.accessor(row => row.project.owner.name, {
		id: "ownerName",
		header: "担当者",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
	}),
	columnHelper.accessor(row => row.project.subOwner?.name ?? "", {
		id: "subOwnerName",
		header: "副担当者",
		cell: ctx => {
			const name = ctx.getValue() as string;
			if (!name)
				return (
					<Text size="2" color="gray">
						─
					</Text>
				);
			return <Text size="2">{name}</Text>;
		},
	}),
];

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table requires any for mixed column value types
function buildDynamicColumn(col: ApiColumn): ColumnDef<MastersheetRow, any> {
	if (col.type === "FORM_ITEM") {
		return columnHelper.accessor(row => row.cells[col.id] ?? null, {
			id: col.id,
			header: col.name,
			cell: FormItemCell,
			meta: { formItemType: col.formItemType ?? undefined },
		});
	}

	if (col.dataType === "SELECT") {
		return columnHelper.accessor(
			row => row.cells[col.id]?.cellValue?.selectedOptionIds?.[0] ?? "",
			{
				id: col.id,
				header: col.name,
				cell: SelectCell,
				meta: {
					editable: true,
					selectOptions: col.options.map(o => ({
						value: o.id,
						label: o.label,
					})),
				},
			}
		);
	}

	if (col.dataType === "MULTI_SELECT") {
		return columnHelper.accessor(
			row => row.cells[col.id]?.cellValue?.selectedOptionIds ?? [],
			{
				id: col.id,
				header: col.name,
				cell: MultiSelectCell,
				meta: {
					selectOptions: col.options.map(o => ({
						value: o.id,
						label: o.label,
					})),
				},
			}
		);
	}

	if (col.dataType === "NUMBER") {
		return columnHelper.accessor(
			row => row.cells[col.id]?.cellValue?.numberValue?.toString() ?? "",
			{
				id: col.id,
				header: col.name,
				cell: EditableCell,
				meta: { editable: true, type: "number" },
			}
		);
	}

	// TEXT (default)
	return columnHelper.accessor(
		row => row.cells[col.id]?.cellValue?.textValue ?? "",
		{
			id: col.id,
			header: col.name,
			cell: EditableCell,
			meta: { editable: true, type: "text" },
		}
	);
}

function buildCustomPayload(
	dataType: ApiColumn["dataType"],
	value: unknown
): UpsertMastersheetCellRequest {
	if (dataType === "NUMBER") {
		return { numberValue: typeof value === "number" ? value : null };
	}
	if (dataType === "SELECT") {
		return {
			selectedOptionIds: typeof value === "string" && value ? [value] : [],
		};
	}
	return { textValue: typeof value === "string" ? value : null };
}

export function MastersheetTable({
	columns,
	rows,
	toolbarExtra,
	initialSorting,
	initialColumnVisibility,
	onSortingChange,
	onColumnVisibilityChange,
}: Props) {
	const router = useRouter();

	const tableData = useMemo(
		(): MastersheetRow[] =>
			rows.map(row => ({
				project: row.project,
				cells: Object.fromEntries(row.cells.map(c => [c.columnId, c])),
			})),
		[rows]
	);

	const tableColumns = useMemo(
		() => [...fixedColumns, ...columns.map(buildDynamicColumn)],
		[columns]
	);

	async function handleCellEdit(
		row: MastersheetRow,
		columnId: string,
		value: unknown
	) {
		const col = columns.find(c => c.id === columnId);
		if (!col) return;

		if (col.type === "FORM_ITEM") {
			await upsertMastersheetOverride(columnId, row.project.id, {
				textValue: typeof value === "string" ? value : null,
				numberValue: typeof value === "number" ? value : null,
			});
		} else {
			await upsertMastersheetCell(
				columnId,
				row.project.id,
				buildCustomPayload(col.dataType, value)
			);
		}

		await router.invalidate();
	}

	return (
		<DataTable<MastersheetRow>
			data={tableData}
			columns={tableColumns}
			features={{
				sorting: true,
				globalFilter: true,
				columnVisibility: false,
				selection: true,
				copy: true,
				csvExport: true,
			}}
			initialSorting={initialSorting}
			initialColumnVisibility={initialColumnVisibility}
			onCellEdit={handleCellEdit}
			onSortingChange={onSortingChange}
			onColumnVisibilityChange={onColumnVisibilityChange}
			toolbarExtra={toolbarExtra}
		/>
	);
}
