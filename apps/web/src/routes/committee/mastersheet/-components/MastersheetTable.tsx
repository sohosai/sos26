import { Text, Tooltip } from "@radix-ui/themes";
import type {
	EditFormItemCellRequest,
	GetMastersheetDataResponse,
	UpsertMastersheetCellRequest,
} from "@sos26/shared";
import { IconFileText, IconPencil } from "@tabler/icons-react";
import { useRouter } from "@tanstack/react-router";
import type { ColumnFiltersState } from "@tanstack/react-table";
import {
	type ColumnDef,
	createColumnHelper,
	type SortingState,
	type VisibilityState,
} from "@tanstack/react-table";
import { type ReactNode, useMemo } from "react";
import { toast } from "sonner";
import {
	DataTable,
	EditableCell,
	MultiSelectEditCell,
	SelectCell,
} from "@/components/patterns";
import {
	editFormItemCell,
	upsertMastersheetCell,
} from "@/lib/api/committee-mastersheet";
import { isClientError } from "@/lib/http/error";
import { FormItemCell } from "./FormItemCell";
import styles from "./MastersheetTable.module.scss";

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
	initialColumnFilters?: ColumnFiltersState;
	onSortingChange?: (sorting: SortingState) => void;
	onColumnVisibilityChange?: (visibility: VisibilityState) => void;
	onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
};

const columnHelper = createColumnHelper<MastersheetRow>();

function ColHeader({ col }: { col: ApiColumn }) {
	return (
		<span className={styles.colHeader}>
			{col.type === "FORM_ITEM" ? (
				<Tooltip content="フォーム由来カラム">
					<IconFileText
						size={12}
						style={{ color: "var(--gray-8)", flexShrink: 0 }}
					/>
				</Tooltip>
			) : (
				<Tooltip content="カスタムカラム">
					<IconPencil
						size={12}
						style={{ color: "var(--gray-8)", flexShrink: 0 }}
					/>
				</Tooltip>
			)}
			{col.name}
		</span>
	);
}

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
		meta: { filterVariant: "text" },
	}),
	columnHelper.accessor(row => row.project.name, {
		id: "name",
		header: "企画名",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
		meta: { filterVariant: "text" },
	}),
	columnHelper.accessor(row => row.project.type, {
		id: "type",
		header: "種別",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
		meta: { filterVariant: "text" },
	}),
	columnHelper.accessor(row => row.project.organizationName, {
		id: "organizationName",
		header: "団体名",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
		meta: { filterVariant: "text" },
	}),
	columnHelper.accessor(row => row.project.owner.name, {
		id: "ownerName",
		header: "責任者",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
		meta: { filterVariant: "text" },
	}),
	columnHelper.accessor(row => row.project.subOwner?.name ?? "", {
		id: "subOwnerName",
		header: "副責任者",
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
		meta: { filterVariant: "text" },
	}),
];

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table requires any for mixed column value types
function buildDynamicColumn(col: ApiColumn): ColumnDef<MastersheetRow, any> {
	if (col.type === "FORM_ITEM") {
		// SELECT 型: SelectCell で選択UI（NOT_DELIVERED は編集不可）
		if (col.formItemType === "SELECT") {
			const selectOptions = col.options.map(o => ({
				value: o.id,
				label: o.label,
			}));
			return columnHelper.accessor(
				row => {
					const cell = row.cells[col.id];
					const effective = cell?.formValue ?? null;
					return effective?.selectedOptionIds?.[0] ?? "";
				},
				{
					id: col.id,
					header: () => <ColHeader col={col} />,
					cell: props => {
						const cell = props.row.original.cells[col.id];
						if (
							!cell?.status ||
							cell.status === "NOT_DELIVERED" ||
							cell.status === "NOT_ANSWERED"
						) {
							return (
								<Text color="gray" size="2">
									─
								</Text>
							);
						}
						return <SelectCell {...props} />;
					},
					meta: {
						editable: true,
						selectOptions,
						filterVariant: "select",
					},
				}
			);
		}

		// CHECKBOX 型: MultiSelectEditCell で複数選択UI（NOT_DELIVERED は編集不可）
		if (col.formItemType === "CHECKBOX") {
			const selectOptions = col.options.map(o => ({
				value: o.id,
				label: o.label,
			}));
			return columnHelper.accessor(
				row => {
					const cell = row.cells[col.id];
					const effective = cell?.formValue ?? null;
					return effective?.selectedOptionIds ?? [];
				},
				{
					id: col.id,
					header: () => <ColHeader col={col} />,
					cell: props => {
						const cell = props.row.original.cells[col.id];
						if (
							!cell?.status ||
							cell.status === "NOT_DELIVERED" ||
							cell.status === "NOT_ANSWERED"
						) {
							return (
								<Text color="gray" size="2">
									─
								</Text>
							);
						}
						return <MultiSelectEditCell {...props} />;
					},
					meta: {
						editable: true,
						selectOptions,
						filterVariant: "select",
					},
				}
			);
		}

		// TEXT / TEXTAREA / NUMBER / FILE: FormItemCell
		return columnHelper.accessor(row => row.cells[col.id] ?? null, {
			id: col.id,
			header: () => <ColHeader col={col} />,
			cell: FormItemCell,
			meta: {
				formItemType: col.formItemType ?? undefined,
				filterVariant: "text",
			},
		});
	}

	if (col.dataType === "SELECT") {
		const selectOptions = col.options.map(o => ({
			value: o.id,
			label: o.label,
		}));
		return columnHelper.accessor(
			row => row.cells[col.id]?.cellValue?.selectedOptionIds?.[0] ?? "",
			{
				id: col.id,
				header: () => <ColHeader col={col} />,
				cell: SelectCell,
				meta: {
					editable: true,
					selectOptions,
					filterVariant: "select",
				},
			}
		);
	}

	if (col.dataType === "MULTI_SELECT") {
		const selectOptions = col.options.map(o => ({
			value: o.id,
			label: o.label,
		}));
		return columnHelper.accessor(
			row => row.cells[col.id]?.cellValue?.selectedOptionIds ?? [],
			{
				id: col.id,
				header: () => <ColHeader col={col} />,
				cell: MultiSelectEditCell,
				meta: {
					editable: true,
					selectOptions,
					filterVariant: "select",
				},
			}
		);
	}

	if (col.dataType === "NUMBER") {
		return columnHelper.accessor(
			row => row.cells[col.id]?.cellValue?.numberValue ?? null,
			{
				id: col.id,
				header: () => <ColHeader col={col} />,
				cell: EditableCell,
				meta: { editable: true, type: "number", filterVariant: "number" },
			}
		);
	}

	// TEXT (default)
	return columnHelper.accessor(
		row => row.cells[col.id]?.cellValue?.textValue ?? "",
		{
			id: col.id,
			header: () => <ColHeader col={col} />,
			cell: EditableCell,
			meta: { editable: true, type: "text" },
		}
	);
}

function buildEditPayload(
	formItemType: ApiColumn["formItemType"],
	value: unknown
): EditFormItemCellRequest {
	if (formItemType === "SELECT") {
		return {
			selectedOptionIds: typeof value === "string" && value ? [value] : [],
		};
	}
	if (formItemType === "CHECKBOX") {
		return {
			selectedOptionIds: Array.isArray(value) ? (value as string[]) : [],
		};
	}
	return {
		textValue: typeof value === "string" ? value : null,
		numberValue: typeof value === "number" ? value : null,
	};
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
	if (dataType === "MULTI_SELECT") {
		return {
			selectedOptionIds: Array.isArray(value) ? (value as string[]) : [],
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
	initialColumnFilters,
	onSortingChange,
	onColumnVisibilityChange,
	onColumnFiltersChange,
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

		try {
			if (col.type === "FORM_ITEM") {
				await editFormItemCell(
					columnId,
					row.project.id,
					buildEditPayload(col.formItemType, value)
				);
			} else {
				await upsertMastersheetCell(
					columnId,
					row.project.id,
					buildCustomPayload(col.dataType, value)
				);
			}
		} catch (error) {
			toast.error(
				isClientError(error) ? error.message : "セルの更新に失敗しました"
			);
			await router.invalidate();
			return;
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
				columnFilter: true,
				selection: true,
				copy: true,
				csvExport: true,
			}}
			initialSorting={initialSorting}
			initialColumnVisibility={initialColumnVisibility}
			initialColumnFilters={initialColumnFilters}
			onCellEdit={handleCellEdit}
			onSortingChange={onSortingChange}
			onColumnVisibilityChange={onColumnVisibilityChange}
			onColumnFiltersChange={onColumnFiltersChange}
			toolbarExtra={toolbarExtra}
		/>
	);
}
