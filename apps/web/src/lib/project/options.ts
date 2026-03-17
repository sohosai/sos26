import type { ProjectLocation, ProjectType } from "@sos26/shared";

export const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
	{ value: "NORMAL", label: "普通企画" },
	{ value: "FOOD", label: "食品企画" },
	{ value: "STAGE", label: "ステージ企画" },
];

export const PROJECT_LOCATION_OPTIONS: {
	value: ProjectLocation;
	label: string;
	caption?: string;
}[] = [
	{
		value: "INDOOR",
		label: "屋内",
		caption: "調理：◯　火気の使用：✖　雨天時：◎",
	},
	{
		value: "OUTDOOR",
		label: "屋外",
		caption: "調理：◎　火気の使用：◎　雨天時：△",
	},
	{ value: "STAGE", label: "ステージ" },
];

export const PROJECT_TYPE_LABELS: Record<string, string> = {
	NORMAL: "普通",
	FOOD: "食品",
	STAGE: "ステージ",
};

export const PROJECT_LOCATION_LABELS: Record<string, string> = {
	INDOOR: "屋内",
	OUTDOOR: "屋外",
	STAGE: "ステージ",
};
