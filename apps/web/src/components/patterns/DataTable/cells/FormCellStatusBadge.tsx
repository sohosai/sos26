import type { BadgeProps } from "@radix-ui/themes";
import { Badge } from "@radix-ui/themes";
import type { MastersheetCellStatus } from "@sos26/shared";

type Props = {
	status: MastersheetCellStatus;
};

const STATUS_CONFIG: Record<
	MastersheetCellStatus,
	{ label: string; color: BadgeProps["color"] }
> = {
	NOT_DELIVERED: { label: "未配信", color: "gray" },
	NOT_ANSWERED: { label: "未回答", color: "orange" },
	SUBMITTED: { label: "提出済み", color: "green" },
	COMMITTEE_EDITED: { label: "実委編集", color: "blue" },
};

export function FormCellStatusBadge({ status }: Props) {
	const config = STATUS_CONFIG[status];
	return (
		<Badge variant="soft" color={config.color} size="1">
			{config.label}
		</Badge>
	);
}
