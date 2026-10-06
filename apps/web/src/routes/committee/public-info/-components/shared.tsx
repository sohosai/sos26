import { Badge, Tooltip } from "@radix-ui/themes";
import type {
	CommitteeProjectPublicInfo,
	CommitteePublicInfoModeration,
	HideableProjectPublicInfoField,
	ProjectPublicInfoField,
	ProjectSnsLinkKey,
} from "@sos26/shared";
import { IconEyeOff, IconPencil } from "@tabler/icons-react";
import { formatDate } from "@/lib/format";
import styles from "./shared.module.scss";

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

/**
 * 項目に付ける「非公開」のバッジと「修正」の印。操作した実委人と日時をツールチップに出す。
 * 修正は補足の情報のため、行を取らない小さな印にする。
 */
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
				<Tooltip content={`非公開：${moderationTitle(hidden)}`}>
					<Badge color="red" variant="soft">
						非公開
					</Badge>
				</Tooltip>
			)}
			{corrected && <CorrectedMark moderation={corrected} />}
		</>
	);
}

/** 非公開にしたことを示す小さな印。画像の上など、バッジだと場所を取る箇所に使う */
export function HiddenMark({
	moderation,
	className,
}: {
	moderation: CommitteePublicInfoModeration;
	className?: string;
}) {
	const label = `非公開：${moderationTitle(moderation)}`;
	return (
		<Tooltip content={label}>
			<span
				role="img"
				aria-label={label}
				className={`${styles.hiddenMark}${className ? ` ${className}` : ""}`}
			>
				<IconEyeOff size={14} />
			</span>
		</Tooltip>
	);
}

/** 実行委員会が修正したことを示す小さな鉛筆の印 */
export function CorrectedMark({
	moderation,
	className,
}: {
	moderation: CommitteePublicInfoModeration;
	className?: string;
}) {
	const label = `実行委員会が修正：${moderationTitle(moderation)}`;
	return (
		<Tooltip content={label}>
			<span
				role="img"
				aria-label={label}
				className={`${styles.correctedMark}${className ? ` ${className}` : ""}`}
			>
				<IconPencil size={14} />
			</span>
		</Tooltip>
	);
}

function moderationTitle(m: CommitteePublicInfoModeration) {
	return `${m.updatedBy.name}（${formatDate(m.updatedAt, "datetime")}）`;
}
