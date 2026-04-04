import { Badge, Link, Text, Tooltip } from "@radix-ui/themes";
import type {
	EditFormItemCellRequest,
	GetMastersheetDataResponse,
	ProjectDeletionStatus,
	UpsertMastersheetCellRequest,
} from "@sos26/shared";
import { type ProjectType, projectTypeSchema } from "@sos26/shared";
import {
	IconClipboardText,
	IconEye,
	IconFileText,
	IconPencil,
} from "@tabler/icons-react";
import { Link as RouterLink, useRouter } from "@tanstack/react-router";
import type { ColumnFiltersState } from "@tanstack/react-table";
import {
	type ColumnDef,
	createColumnHelper,
	type SortingState,
	type VisibilityState,
} from "@tanstack/react-table";
import { type ReactNode, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
	DataTable,
	EditableCell,
	MultiSelectEditCell,
	SelectCell,
} from "@/components/patterns";
import { Button } from "@/components/primitives";
import {
	editFormItemCell,
	upsertMastersheetCell,
} from "@/lib/api/committee-mastersheet";
import { formatProjectNumber } from "@/lib/format";
import { isClientError } from "@/lib/http/error";
import { useStorageUrl } from "@/lib/storage";
import styles from "./MastersheetTable.module.scss";

type MastersheetRow = {
	project: GetMastersheetDataResponse["rows"][number]["project"];
	cells: Record<
		string,
		GetMastersheetDataResponse["rows"][number]["cells"][number]
	>;
};

type ApiColumn = GetMastersheetDataResponse["columns"][number];

export type SelectedCell = {
	columnId: string;
	projectId: string;
};

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
	onSelectionChange?: (cells: SelectedCell[]) => void;
	selectionIgnoreRef?: React.RefObject<HTMLElement | null>;
};

const PROJECT_TYPE_LABEL = {
	STAGE: "ステージ企画",
	FOOD: "食品企画",
	NORMAL: "普通企画",
} satisfies Record<ProjectType, string>;

type ProjectDeletionFilterValue = "ACTIVE" | "DELETED" | "LOTTERY_LOSS";

function projectDeletionStatusLabel(
	status: ProjectDeletionStatus | null
): string {
	if (status === "LOTTERY_LOSS") return "落選";
	if (status === "DELETED") return "削除";
	return "有効";
}
const columnHelper = createColumnHelper<MastersheetRow>();

function ColHeader({ col }: { col: ApiColumn }) {
	let icon: ReactNode;
	if (col.type === "FORM_ITEM") {
		icon = (
			<Tooltip content="申請由来カラム">
				<IconFileText
					size={12}
					style={{ color: "var(--gray-8)", flexShrink: 0 }}
				/>
			</Tooltip>
		);
	} else if (col.type === "PROJECT_REGISTRATION_FORM_ITEM") {
		icon = (
			<Tooltip content="企画登録情報由来カラム">
				<IconClipboardText
					size={12}
					style={{ color: "var(--gray-8)", flexShrink: 0 }}
				/>
			</Tooltip>
		);
	} else {
		icon = (
			<Tooltip content="カスタムカラム">
				<IconPencil
					size={12}
					style={{ color: "var(--gray-8)", flexShrink: 0 }}
				/>
			</Tooltip>
		);
	}
	return (
		<span className={styles.colHeader}>
			{icon}
			{col.name}
		</span>
	);
}

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table requires any for mixed column value types
const fixedColumns: ColumnDef<MastersheetRow, any>[] = [
	columnHelper.display({
		id: "actions",
		header: "操作",
		cell: ({ row }) => (
			<RouterLink
				to="/committee/info/$projectId"
				params={{
					projectId: formatProjectNumber(row.original.project.number),
				}}
			>
				<Button intent="ghost" size="1">
					<IconEye size={16} />
					詳細
				</Button>
			</RouterLink>
		),
		enableSorting: false,
	}),
	columnHelper.accessor(row => formatProjectNumber(row.project.number), {
		id: "number",
		header: "企画番号",
		cell: ctx => (
			<Text size="2" weight="medium">
				{ctx.getValue() as string}
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
	columnHelper.accessor(row => row.project.namePhonetic, {
		id: "namePhonetic",
		header: "企画名（ふりがな）",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
		meta: { filterVariant: "text" },
	}),
	columnHelper.accessor(row => row.project.type, {
		id: "type",
		header: "企画区分",
		cell: ctx => (
			<Text size="2">{PROJECT_TYPE_LABEL[ctx.getValue() as ProjectType]}</Text>
		),
		meta: {
			filterVariant: "select",
			selectOptions: projectTypeSchema.options.map(v => ({
				value: v,
				label: PROJECT_TYPE_LABEL[v],
			})),
		},
	}),
	columnHelper.accessor(row => row.project.organizationName, {
		id: "organizationName",
		header: "団体名",
		cell: ctx => <Text size="2">{ctx.getValue() as string}</Text>,
		meta: { filterVariant: "text" },
	}),
	columnHelper.accessor(row => row.project.organizationNamePhonetic, {
		id: "organizationNamePhonetic",
		header: "団体名（ふりがな）",
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
	columnHelper.accessor(
		row =>
			(row.project.deletionStatus ??
				"ACTIVE") satisfies ProjectDeletionFilterValue,
		{
			id: "deletionStatus",
			header: "企画状況",
			cell: ctx => (
				<Badge
					color={ctx.row.original.project.deletionStatus ? "red" : "green"}
				>
					{projectDeletionStatusLabel(ctx.row.original.project.deletionStatus)}
				</Badge>
			),
			meta: {
				filterVariant: "select",
				selectOptions: [
					{ value: "ACTIVE", label: "有効" },
					{ value: "DELETED", label: "削除" },
					{ value: "LOTTERY_LOSS", label: "落選" },
				],
			},
		}
	),
];

/** FORM_ITEM セルが編集可能か否か */
function isFormItemInactive(row: MastersheetRow, colId: string): boolean {
	const status = row.cells[colId]?.status;
	return (
		!status ||
		status === "NOT_DELIVERED" ||
		status === "NOT_ANSWERED" ||
		status === "NOT_APPLICABLE"
	);
}

const INACTIVE_PLACEHOLDER = (
	<Text color="gray" size="2">
		─
	</Text>
);

type FormCellFile = NonNullable<
	GetMastersheetDataResponse["rows"][number]["cells"][number]["formValue"]
>["files"][number];

function CompactFileLink({ file }: { file: FormCellFile }) {
	const url = useStorageUrl(file.id, file.isPublic);

	if (!url) {
		return <Text size="2">{file.fileName}</Text>;
	}

	return (
		<Link href={url} target="_blank" rel="noopener noreferrer" size="2">
			{file.fileName}
		</Link>
	);
}

function CompactFileCell({ files }: { files: FormCellFile[] }) {
	if (files.length === 0) {
		return (
			<Text color="gray" size="2">
				─
			</Text>
		);
	}

	const [first, ...rest] = files
		.slice()
		.sort((a, b) => a.sortOrder - b.sortOrder);
	if (!first) {
		return (
			<Text color="gray" size="2">
				─
			</Text>
		);
	}

	return (
		<div>
			<CompactFileLink file={first} />
			{rest.length > 0 && (
				<Text size="1" color="gray">
					{" "}
					+{rest.length}件
				</Text>
			)}
		</div>
	);
}

/** 企画登録情報由来カラム（読み取り専用） */
function buildPrfReadOnlyColumn(
	col: ApiColumn
	// biome-ignore lint/suspicious/noExplicitAny: TanStack Table requires any for mixed column value types
): ColumnDef<MastersheetRow, any> {
	const itemType = col.projectRegistrationFormItemType;
	const optionMap = new Map(col.options.map(o => [o.id, o.label]));

	if (itemType === "SELECT" || itemType === "CHECKBOX") {
		return columnHelper.accessor(
			row => row.cells[col.id]?.formValue?.selectedOptionIds ?? [],
			{
				id: col.id,
				header: () => <ColHeader col={col} />,
				cell: props => {
					const ids = props.getValue() as string[];
					if (!ids.length) return INACTIVE_PLACEHOLDER;
					return (
						<Text size="2">
							{ids.map(id => optionMap.get(id) ?? id).join(", ")}
						</Text>
					);
				},
				meta: {
					filterVariant: "select",
					selectOptions: col.options.map(o => ({
						value: o.id,
						label: o.label,
					})),
				},
			}
		);
	}

	if (itemType === "NUMBER") {
		return columnHelper.accessor(
			row => row.cells[col.id]?.formValue?.numberValue ?? null,
			{
				id: col.id,
				header: () => <ColHeader col={col} />,
				cell: props => {
					const v = props.getValue();
					return v == null ? INACTIVE_PLACEHOLDER : <Text size="2">{v}</Text>;
				},
				meta: { filterVariant: "number" },
			}
		);
	}

	if (itemType === "FILE") {
		return columnHelper.accessor(
			row => row.cells[col.id]?.formValue?.files ?? [],
			{
				id: col.id,
				header: () => <ColHeader col={col} />,
				cell: props => (
					<CompactFileCell files={props.getValue() as FormCellFile[]} />
				),
				meta: { filterVariant: "text" },
			}
		);
	}

	// TEXT / TEXTAREA
	return columnHelper.accessor(
		row => row.cells[col.id]?.formValue?.textValue ?? "",
		{
			id: col.id,
			header: () => <ColHeader col={col} />,
			cell: props => {
				const v = props.getValue();
				return v ? <Text size="2">{v}</Text> : INACTIVE_PLACEHOLDER;
			},
			meta: { filterVariant: "text" },
		}
	);
}

// biome-ignore lint/suspicious/noExplicitAny: TanStack Table requires any for mixed column value types
function buildDynamicColumn(col: ApiColumn): ColumnDef<MastersheetRow, any> {
	// 企画登録情報由来カラムは読み取り専用
	if (col.type === "PROJECT_REGISTRATION_FORM_ITEM") {
		return buildPrfReadOnlyColumn(col);
	}

	if (col.type === "FORM_ITEM") {
		const itemType = col.formItemType;
		const selectOptions = col.options.map(o => ({
			value: o.id,
			label: o.label,
		}));

		if (itemType === "SELECT") {
			return columnHelper.accessor(
				row => row.cells[col.id]?.formValue?.selectedOptionIds?.[0] ?? "",
				{
					id: col.id,
					header: () => <ColHeader col={col} />,
					cell: props =>
						isFormItemInactive(props.row.original, col.id) ? (
							INACTIVE_PLACEHOLDER
						) : (
							<SelectCell {...props} />
						),
					meta: { editable: true, selectOptions, filterVariant: "select" },
				}
			);
		}

		if (itemType === "CHECKBOX") {
			return columnHelper.accessor(
				row => row.cells[col.id]?.formValue?.selectedOptionIds ?? [],
				{
					id: col.id,
					header: () => <ColHeader col={col} />,
					cell: props =>
						isFormItemInactive(props.row.original, col.id) ? (
							INACTIVE_PLACEHOLDER
						) : (
							<MultiSelectEditCell {...props} />
						),
					meta: { editable: true, selectOptions, filterVariant: "select" },
				}
			);
		}

		if (itemType === "NUMBER") {
			return columnHelper.accessor(
				row => row.cells[col.id]?.formValue?.numberValue ?? null,
				{
					id: col.id,
					header: () => <ColHeader col={col} />,
					cell: props =>
						isFormItemInactive(props.row.original, col.id) ? (
							INACTIVE_PLACEHOLDER
						) : (
							<EditableCell {...props} />
						),
					meta: { editable: true, type: "number", filterVariant: "number" },
				}
			);
		}

		if (itemType === "FILE") {
			return columnHelper.accessor(
				row => row.cells[col.id]?.formValue?.files ?? [],
				{
					id: col.id,
					header: () => <ColHeader col={col} />,
					cell: props =>
						isFormItemInactive(props.row.original, col.id) ? (
							INACTIVE_PLACEHOLDER
						) : (
							<CompactFileCell files={props.getValue() as FormCellFile[]} />
						),
					meta: { filterVariant: "text" },
				}
			);
		}

		// TEXT / TEXTAREA
		return columnHelper.accessor(
			row => row.cells[col.id]?.formValue?.textValue ?? "",
			{
				id: col.id,
				header: () => <ColHeader col={col} />,
				cell: props =>
					isFormItemInactive(props.row.original, col.id) ? (
						INACTIVE_PLACEHOLDER
					) : (
						<EditableCell {...props} />
					),
				meta: { editable: true, type: "text", filterVariant: "text" },
			}
		);
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
			meta: { editable: true, type: "text", filterVariant: "text" },
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
	onSelectionChange,
	selectionIgnoreRef,
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

	const handleSelectionChange = useCallback(
		(items: { row: MastersheetRow; columnId: string }[]) => {
			if (!onSelectionChange) return;
			const cells: SelectedCell[] = items.map(item => ({
				columnId: item.columnId,
				projectId: item.row.project.id,
			}));
			onSelectionChange(cells);
		},
		[onSelectionChange]
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
			} else if (col.type === "PROJECT_REGISTRATION_FORM_ITEM") {
				return; // 読み取り専用
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
			onSelectionChange={handleSelectionChange}
			selectionIgnoreRef={selectionIgnoreRef}
		/>
	);
}
