import { Badge } from "@radix-ui/themes";
import type {
	CommitteePublicInfoItem,
	ProjectPublicInfoField,
	ProjectSnsLinkKey,
} from "@sos26/shared";

export const SNS_FIELDS: {
	key: ProjectSnsLinkKey;
	field: ProjectPublicInfoField;
	label: string;
}[] = [
	{ key: "websiteUrls", field: "WEBSITE_URLS", label: "Webサイト" },
	{ key: "xIds", field: "X_IDS", label: "X" },
	{ key: "instagramIds", field: "INSTAGRAM_IDS", label: "Instagram" },
	{ key: "youtubeIds", field: "YOUTUBE_IDS", label: "YouTube" },
];

export function findModeration(
	item: CommitteePublicInfoItem,
	field: ProjectPublicInfoField,
	kind: "HIDDEN" | "CORRECTED"
) {
	return item.moderations.find(m => m.field === field && m.kind === kind);
}

/** 項目に付ける「非表示」「修正」のバッジ */
export function FieldStatusBadges({
	item,
	field,
}: {
	item: CommitteePublicInfoItem;
	field: ProjectPublicInfoField;
}) {
	return (
		<>
			{findModeration(item, field, "HIDDEN") && (
				<Badge color="red" variant="soft">
					非表示
				</Badge>
			)}
			{findModeration(item, field, "CORRECTED") && (
				<Badge color="blue" variant="soft">
					修正
				</Badge>
			)}
		</>
	);
}
