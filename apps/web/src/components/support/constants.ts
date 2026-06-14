import type { InquiryStatus } from "@sos26/shared";
import {
	IconAlertCircle,
	IconCircleCheck,
	IconMessageDots,
} from "@tabler/icons-react";

export const statusConfig: Record<
	InquiryStatus,
	{
		label: string;
		color: "orange" | "blue" | "green";
		icon: typeof IconAlertCircle;
	}
> = {
	UNASSIGNED: {
		label: "担当者未割り当て",
		color: "orange",
		icon: IconAlertCircle,
	},
	IN_PROGRESS: { label: "対応中", color: "blue", icon: IconMessageDots },
	RESOLVED: { label: "解決済み", color: "green", icon: IconCircleCheck },
};
