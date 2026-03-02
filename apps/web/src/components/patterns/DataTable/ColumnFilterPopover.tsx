import { Flex, Popover, Text, TextField } from "@radix-ui/themes";
import { IconFilter } from "@tabler/icons-react";
import type { Column, RowData } from "@tanstack/react-table";
import { Checkbox } from "@/components/primitives";

type NumberRangeValue = { min: string; max: string };
type SelectValue = string[];

function TextFilter<TData extends RowData>({
	column,
}: {
	column: Column<TData, unknown>;
}) {
	const value = (column.getFilterValue() as string | undefined) ?? "";
	return (
		<Flex direction="column" gap="2" style={{ minWidth: "180px" }}>
			<Text size="1" weight="bold">
				テキスト検索
			</Text>
			<TextField.Root
				size="1"
				placeholder="絞り込み..."
				value={value}
				onChange={e => column.setFilterValue(e.target.value || undefined)}
			/>
		</Flex>
	);
}

function NumberFilter<TData extends RowData>({
	column,
}: {
	column: Column<TData, unknown>;
}) {
	const value =
		(column.getFilterValue() as NumberRangeValue | undefined) ??
		({ min: "", max: "" } as NumberRangeValue);
	const update = (key: "min" | "max", val: string) => {
		const next = { ...value, [key]: val };
		column.setFilterValue(next.min || next.max ? next : undefined);
	};
	return (
		<Flex direction="column" gap="2" style={{ minWidth: "160px" }}>
			<Text size="1" weight="bold">
				数値フィルター
			</Text>
			<TextField.Root
				size="1"
				placeholder="最小値"
				type="number"
				value={value.min}
				onChange={e => update("min", e.target.value)}
			/>
			<TextField.Root
				size="1"
				placeholder="最大値"
				type="number"
				value={value.max}
				onChange={e => update("max", e.target.value)}
			/>
		</Flex>
	);
}

function SelectFilter<TData extends RowData>({
	column,
}: {
	column: Column<TData, unknown>;
}) {
	const selected = (column.getFilterValue() as SelectValue | undefined) ?? [];
	const rawOptions = column.columnDef.meta?.selectOptions;
	const options =
		rawOptions ??
		(column.columnDef.meta?.options ?? []).map(o => ({ value: o, label: o }));

	const toggle = (v: string) => {
		const next = selected.includes(v)
			? selected.filter(s => s !== v)
			: [...selected, v];
		column.setFilterValue(next.length ? next : undefined);
	};

	return (
		<Flex
			direction="column"
			gap="1"
			style={{ minWidth: "160px", maxHeight: "240px", overflowY: "auto" }}
		>
			<Text size="1" weight="bold" mb="1">
				選択フィルター
			</Text>
			{options.map(opt => (
				<Checkbox
					key={opt.value}
					size="1"
					label={opt.label}
					checked={selected.includes(opt.value)}
					onCheckedChange={() => toggle(opt.value)}
				/>
			))}
		</Flex>
	);
}

export function ColumnFilterPopover<TData extends RowData>({
	column,
}: {
	column: Column<TData, unknown>;
}) {
	const variant = column.columnDef.meta?.filterVariant ?? "text";
	const isFiltered = column.getIsFiltered();

	return (
		<Popover.Root>
			<Popover.Trigger
				onClick={e => e.stopPropagation()}
				style={{
					background: "none",
					border: "none",
					cursor: "pointer",
					padding: "2px",
					lineHeight: 0,
					color: isFiltered ? "var(--accent-9)" : "var(--gray-9)",
				}}
			>
				<IconFilter size={12} />
			</Popover.Trigger>
			<Popover.Content>
				{variant === "number" ? (
					<NumberFilter column={column} />
				) : variant === "select" ? (
					<SelectFilter column={column} />
				) : (
					<TextFilter column={column} />
				)}
			</Popover.Content>
		</Popover.Root>
	);
}
