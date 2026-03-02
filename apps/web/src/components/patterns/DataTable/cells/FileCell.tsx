import { Link, Text } from "@radix-ui/themes";
import { IconFile } from "@tabler/icons-react";
import type { CellContext, RowData } from "@tanstack/react-table";

export function FileCell<TData extends RowData>({
	getValue,
}: CellContext<TData, unknown>) {
	const url = getValue() as string | null | undefined;

	if (!url) {
		return (
			<Text color="gray" size="1">
				-
			</Text>
		);
	}

	const filename = url.split("/").at(-1) ?? "ファイル";

	return (
		<Link href={url} target="_blank" rel="noopener noreferrer" size="2">
			<IconFile size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
			{filename}
		</Link>
	);
}
