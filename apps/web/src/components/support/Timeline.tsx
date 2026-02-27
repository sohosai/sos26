import { Badge, Text } from "@radix-ui/themes";
import type { InquiryAttachment } from "@sos26/shared";
import { IconDownload } from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { toast } from "sonner";
import { downloadFile } from "@/lib/api/files";
import { formatDate, formatFileSize } from "@/lib/format";
import { useStorageUrl } from "@/lib/storage";
import styles from "./SupportDetail.module.scss";
import type { ActivityInfo } from "./types";

export function TimelineItem({
	name,
	role,
	date,
	body,
	attachments,
}: {
	name: string;
	role: "project" | "committee";
	date: Date;
	body: string;
	attachments?: InquiryAttachment[];
}) {
	return (
		<div className={styles.timelineItem}>
			<span className={styles.avatar}>
				<Avatar size={28} name={name} variant="beam" />
			</span>
			<div className={styles.timelineContent}>
				<div className={styles.timelineHeader}>
					<Text size="2" weight="medium">
						{name}
					</Text>
					<Badge
						size="1"
						variant="soft"
						color={role === "committee" ? "blue" : "green"}
					>
						{role === "committee" ? "実行委員" : "企画者"}
					</Badge>
					<Text size="1" color="gray" className={styles.timelineHeaderMeta}>
						{formatDate(date, "datetime")}
					</Text>
				</div>
				<Text size="2" className={styles.timelineBody}>
					{body}
				</Text>
				{attachments && attachments.length > 0 && (
					<div className={styles.attachmentSection}>
						{attachments.map(att =>
							att.mimeType.startsWith("image/") ? (
								<AttachmentImage key={att.id} attachment={att} />
							) : (
								<button
									key={att.id}
									type="button"
									className={styles.attachmentItem}
									onClick={() =>
										downloadFile(att.fileId, att.fileName, att.isPublic).catch(
											() => toast.error("ファイルの取得に失敗しました")
										)
									}
								>
									<IconDownload size={14} />
									<Text size="2">{att.fileName}</Text>
									<Text size="1" color="gray">
										({formatFileSize(att.size)})
									</Text>
								</button>
							)
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function AttachmentImage({ attachment }: { attachment: InquiryAttachment }) {
	const url = useStorageUrl(attachment.fileId, attachment.isPublic);
	if (!url) return null;
	return (
		<img
			src={url}
			alt={attachment.fileName}
			className={styles.attachmentImage}
		/>
	);
}

function getActivityText(activity: ActivityInfo): string {
	const actor = activity.actor.name;
	switch (activity.type) {
		case "ASSIGNEE_ADDED": {
			const target = activity.target?.name ?? "";
			return actor === target
				? `${actor} が担当者になりました`
				: `${actor} が ${target} を担当者に設定しました`;
		}
		case "ASSIGNEE_REMOVED": {
			const target = activity.target?.name ?? "";
			return actor === target
				? `${actor} が担当者から外れました`
				: `${actor} が ${target} を担当者から外しました`;
		}
		case "STATUS_RESOLVED":
			return `${actor} がこのお問い合わせを解決済みにしました`;
		case "STATUS_REOPENED":
			return `${actor} がこのお問い合わせを再オープンしました`;
		case "VIEWER_UPDATED":
			return `${actor} が閲覧者設定を変更しました`;
	}
}

export function ActivityItem({ activity }: { activity: ActivityInfo }) {
	return (
		<div className={styles.activityItem}>
			<Text size="1" color="gray">
				{getActivityText(activity)} —{" "}
				{formatDate(activity.createdAt, "datetime")}
			</Text>
		</div>
	);
}
