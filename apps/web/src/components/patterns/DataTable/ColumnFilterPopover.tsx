import { Popover, Text, TextField } from "@radix-ui/themes";
import { IconFilter } from "@tabler/icons-react";
import type { Column, RowData } from "@tanstack/react-table";
import { Checkbox } from "@/components/primitives";
import styles from "./ColumnFilterPopover.module.scss";

type NumberRangeValue = { min: string; max: string };
type SelectValue = string[];

function TextFilter<TData extends RowData>({
	column,
}: {
	column: Column<TData, unknown>;
}) {
	const value = (column.getFilterValue() as string | undefined) ?? "";
	return (
		<div className={`${styles.filter} ${styles.filterWide}`}>
			<Text size="1" weight="bold">
				テキスト検索
			</Text>
			<TextField.Root
				size="1"
				placeholder="絞り込み..."
				value={value}
				onChange={e => column.setFilterValue(e.target.value || undefined)}
			/>
		</div>
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
		<div className={styles.filter}>
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
		</div>
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
		<div className={styles.selectFilter}>
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
		</div>
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
				className={`${styles.triggerBtn}${isFiltered ? ` ${styles.active}` : ""}`}
			>
				<IconFilter size={18} />
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
