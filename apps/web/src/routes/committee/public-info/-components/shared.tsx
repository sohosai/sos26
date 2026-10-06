import { Badge } from "@radix-ui/themes";
import type {
	CommitteeProjectPublicInfo,
	CommitteePublicInfoModeration,
	HideableProjectPublicInfoField,
	ProjectPublicInfoField,
	ProjectSnsLinkKey,
} from "@sos26/shared";
import { formatDate } from "@/lib/format";

export const SNS_FIELDS: {
	key: ProjectSnsLinkKey;
	field: HideableProjectPublicInfoField;
	label: string;
}[] = [
	{ key: "websiteUrls", field: "WEBSITE_URLS", label: "Webサイト" },
	{ key: "xIds", field: "X_IDS", label: "X" },
	{ key: "instagramIds", field: "INSTAGRAM_IDS", label: "Instagram" },
	{ key: "youtubeIds", field: "YOUTUBE_IDS", label: "YouTube" },
];

export function findModeration(
	item: CommitteeProjectPublicInfo,
	field: ProjectPublicInfoField,
	kind: "HIDDEN" | "CORRECTED"
) {
	return item.moderations.find(m => m.field === field && m.kind === kind);
}

/** 項目に付ける「非表示」「修正」のバッジ。操作した実委人と日時をツールチップに出す */
export function FieldStatusBadges({
	item,
	field,
}: {
	item: CommitteeProjectPublicInfo;
	field: ProjectPublicInfoField;
}) {
	const hidden = findModeration(item, field, "HIDDEN");
	const corrected = findModeration(item, field, "CORRECTED");
	return (
		<>
			{hidden && (
				<Badge color="red" variant="soft" title={moderationTitle(hidden)}>
					非表示
				</Badge>
			)}
			{corrected && (
				<Badge color="blue" variant="soft" title={moderationTitle(corrected)}>
					修正
				</Badge>
			)}
		</>
	);
}

function moderationTitle(m: CommitteePublicInfoModeration) {
	return `${m.updatedBy.name}（${formatDate(m.updatedAt, "datetime")}）`;
}
