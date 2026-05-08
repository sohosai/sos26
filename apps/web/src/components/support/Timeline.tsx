import { Badge, Text } from "@radix-ui/themes";
import type { InquiryAttachment } from "@sos26/shared";
import { IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/common/UserAvatar";
import { AttachmentPreviewButton } from "@/components/filePreview/AttachmentPreviewButton";
import { formatDate } from "@/lib/format";
import { useStorageUrl } from "@/lib/storage";
import { Button, TextArea } from "../primitives";
import styles from "./SupportDetail.module.scss";
import type { ActivityInfo } from "./types";

type TimelineItemProps = {
	name: string;
	avatarFileId?: string | null;
	committeeBureau?: string;
	affiliatedProjects?: string[];
	role: "project" | "committee";
	date: Date;
	body: string;
	attachments?: InquiryAttachment[];
	isDraft?: boolean;
	isOwnDraft?: boolean;
	onPublishDraft?: () => Promise<void>;
	onDeleteDraft?: () => Promise<void>;
	onUpdateDraft?: (body: string) => Promise<void>;
};

function formatDisplayName(
	name: string,
	role: "project" | "committee",
	committeeBureau?: string,
	affiliatedProjects?: string[]
): string {
	if (role === "committee" && committeeBureau) {
		return `${name} (${committeeBureau})`;
	}
	if (
		role === "project" &&
		affiliatedProjects &&
		affiliatedProjects.length > 0
	) {
		return `${name} (${affiliatedProjects.join("・")})`;
	}
	return name;
}

function TimelineHeader({
	name,
	committeeBureau,
	affiliatedProjects,
	role,
	isDraft,
	date,
}: {
	name: string;
	committeeBureau?: string;
	affiliatedProjects?: string[];
	role: "project" | "committee";
	isDraft?: boolean;
	date: Date;
}) {
	return (
		<div className={styles.timelineHeader}>
			<Text size="2" weight="medium">
				{formatDisplayName(name, role, committeeBureau, affiliatedProjects)}
			</Text>
			<Badge
				size="1"
				variant="soft"
				color={role === "committee" ? "blue" : "green"}
			>
				{role === "committee" ? "実行委員" : "企画者"}
			</Badge>
			{isDraft && (
				<Badge size="1" variant="soft" color="orange">
					下書き
				</Badge>
			)}
			<Text size="1" color="gray" className={styles.timelineHeaderMeta}>
				{formatDate(date, "datetime")}
			</Text>
		</div>
	);
}

function TimelineBodySection({
	isEditingDraft,
	draftBody,
	isDraftActionPending,
	onDraftBodyChange,
	body,
}: {
	isEditingDraft: boolean;
	draftBody: string;
	isDraftActionPending: boolean;
	onDraftBodyChange: (value: string) => void;
	body: string;
}) {
	if (isEditingDraft) {
		return (
			<div className={styles.draftEditor}>
				<TextArea
					label="下書き内容"
					value={draftBody}
					onChange={onDraftBodyChange}
					rows={4}
					disabled={isDraftActionPending}
					autoGrow
				/>
			</div>
		);
	}

	return (
		<Text size="2" className={styles.timelineBody}>
			{body}
		</Text>
	);
}

function DraftActionButtons({
	isEditingDraft,
	isDraftActionPending,
	canUpdateDraft,
	canSaveDraft,
	isUpdatingDraft,
	isPublishingDraft,
	isDeletingDraft,
	onStartEdit,
	onCancelEdit,
	onUpdateDraft,
	onPublishDraft,
	onDeleteDraft,
}: {
	isEditingDraft: boolean;
	isDraftActionPending: boolean;
	canUpdateDraft: boolean;
	canSaveDraft: boolean;
	isUpdatingDraft: boolean;
	isPublishingDraft: boolean;
	isDeletingDraft: boolean;
	onStartEdit: () => void;
	onCancelEdit: () => void;
	onUpdateDraft: () => void;
	onPublishDraft?: () => void;
	onDeleteDraft?: () => void;
}) {
	if (isEditingDraft) {
		return (
			<>
				<Button
					intent="secondary"
					onClick={onCancelEdit}
					disabled={isDraftActionPending}
				>
					キャンセル
				</Button>
				<Button
					onClick={onUpdateDraft}
					disabled={isDraftActionPending || !canSaveDraft}
				>
					{isUpdatingDraft ? "保存中..." : "保存"}
				</Button>
			</>
		);
	}

	return (
		<>
			{canUpdateDraft && (
				<Button
					intent="secondary"
					onClick={onStartEdit}
					disabled={isDraftActionPending}
				>
					編集
				</Button>
			)}
			{onPublishDraft && (
				<Button
					intent="primary"
					onClick={onPublishDraft}
					disabled={isDraftActionPending}
				>
					{isPublishingDraft ? "送信中..." : "送信"}
				</Button>
			)}
			{onDeleteDraft && (
				<Button
					intent="ghost"
					onClick={onDeleteDraft}
					disabled={isDraftActionPending}
				>
					<IconTrash size={14} />
					{isDeletingDraft ? "削除中..." : "削除"}
				</Button>
			)}
		</>
	);
}

export function TimelineItem({
	name,
	avatarFileId,
	committeeBureau,
	affiliatedProjects,
	role,
	date,
	body,
	attachments,
	isDraft,
	isOwnDraft,
	onPublishDraft,
	onDeleteDraft,
	onUpdateDraft,
}: TimelineItemProps) {
	const [isPublishingDraft, setIsPublishingDraft] = useState(false);
	const [isDeletingDraft, setIsDeletingDraft] = useState(false);
	const [isUpdatingDraft, setIsUpdatingDraft] = useState(false);
	const [isEditingDraft, setIsEditingDraft] = useState(false);
	const [draftBody, setDraftBody] = useState(body);
	const isDraftActionPending =
		isPublishingDraft || isDeletingDraft || isUpdatingDraft;

	useEffect(() => {
		if (!isEditingDraft) {
			setDraftBody(body);
		}
	}, [body, isEditingDraft]);
	const showDraftActions = Boolean(isDraft && isOwnDraft);
	const canUpdateDraft = Boolean(onUpdateDraft);
	const canSaveDraft = draftBody.trim().length > 0;

	const handlePublishDraft = async () => {
		if (!onPublishDraft || isDraftActionPending) {
			return;
		}
		setIsPublishingDraft(true);
		try {
			await onPublishDraft();
		} finally {
			setIsPublishingDraft(false);
		}
	};

	const handleDeleteDraft = async () => {
		if (!onDeleteDraft || isDraftActionPending) {
			return;
		}
		setIsDeletingDraft(true);
		try {
			await onDeleteDraft();
		} finally {
			setIsDeletingDraft(false);
		}
	};

	const handleStartEditDraft = () => {
		if (!onUpdateDraft || isDraftActionPending) {
			return;
		}
		setDraftBody(body);
		setIsEditingDraft(true);
	};

	const handleCancelEditDraft = () => {
		if (isDraftActionPending) {
			return;
		}
		setDraftBody(body);
		setIsEditingDraft(false);
	};

	const handleUpdateDraft = async () => {
		if (!onUpdateDraft || isDraftActionPending || !draftBody.trim()) {
			return;
		}
		setIsUpdatingDraft(true);
		try {
			await onUpdateDraft(draftBody.trim());
			setIsEditingDraft(false);
		} finally {
			setIsUpdatingDraft(false);
		}
	};

	return (
		<div className={styles.timelineItem} data-draft={isDraft || undefined}>
			<span className={styles.avatar}>
				<UserAvatar size={28} name={name} avatarFileId={avatarFileId} />
			</span>
			<div className={styles.timelineContent}>
				<TimelineHeader
					name={name}
					committeeBureau={committeeBureau}
					affiliatedProjects={affiliatedProjects}
					role={role}
					isDraft={isDraft}
					date={date}
				/>
				<TimelineBodySection
					isEditingDraft={isEditingDraft}
					draftBody={draftBody}
					isDraftActionPending={isDraftActionPending}
					onDraftBodyChange={setDraftBody}
					body={body}
				/>
				{attachments && attachments.length > 0 && (
					<div className={styles.attachmentSection}>
						{attachments.map(att =>
							att.mimeType.startsWith("image/") ? (
								<AttachmentImage key={att.id} attachment={att} />
							) : (
								<AttachmentPreviewButton key={att.id} attachment={att} />
							)
						)}
					</div>
				)}
				{showDraftActions && (
					<div className={styles.draftActions}>
						<DraftActionButtons
							isEditingDraft={isEditingDraft}
							isDraftActionPending={isDraftActionPending}
							canUpdateDraft={canUpdateDraft}
							canSaveDraft={canSaveDraft}
							isUpdatingDraft={isUpdatingDraft}
							isPublishingDraft={isPublishingDraft}
							isDeletingDraft={isDeletingDraft}
							onStartEdit={handleStartEditDraft}
							onCancelEdit={handleCancelEditDraft}
							onUpdateDraft={handleUpdateDraft}
							onPublishDraft={onPublishDraft ? handlePublishDraft : undefined}
							onDeleteDraft={onDeleteDraft ? handleDeleteDraft : undefined}
						/>
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
