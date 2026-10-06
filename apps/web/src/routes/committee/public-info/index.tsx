import { Badge, Card, Heading, Link, Text } from "@radix-ui/themes";
import type {
	CommitteeProjectPublicInfo,
	OpenStatus,
	ProjectPublicInfoField,
	StockStatus,
} from "@sos26/shared";
import { IconDownload, IconEdit } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/primitives";
import { getFileContentUrl } from "@/lib/api/files";
import { listCommitteeProjectPublicInfos } from "@/lib/api/project-public-info";
import { useAuthStore } from "@/lib/auth";
import { formatProjectNumber } from "@/lib/format";
import { ImagePreviewModal } from "../../project/public-info/ImagePreviewModal";
import { PublicInfoDetailDialog } from "./-components/PublicInfoDetailDialog";
import { FieldStatusBadges, findModeration } from "./-components/shared";
import styles from "./index.module.scss";

export const Route = createFileRoute("/committee/public-info/")({
	loader: () => listCommitteeProjectPublicInfos(),
	component: PublicInfoListPage,
	head: () => ({
		meta: [
			{ title: "企画情報一覧 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "企画が入力した企画情報の一覧" },
		],
	}),
});

type PublicInfo = NonNullable<CommitteeProjectPublicInfo["publicInfo"]>;

type Preview = { fileIds: string[]; index: number };

const OPEN_STATUS_LABELS: Record<OpenStatus, string | null> = {
	OPEN: "営業中",
	CLOSED: "準備中・閉店",
	NOT_APPLICABLE: null,
};

const STOCK_STATUS_LABELS: Record<StockStatus, string | null> = {
	IN_STOCK: "在庫あり",
	OUT_OF_STOCK: "在庫なし",
	NOT_APPLICABLE: null,
};

function snsLinks(info: PublicInfo): {
	service: string;
	field: ProjectPublicInfoField;
	text: string;
	href: string;
}[] {
	return [
		...info.websiteUrls.map(url => ({
			service: "Website",
			field: "WEBSITE_URLS" as const,
			text: url,
			href: url,
		})),
		...info.xIds.map(id => ({
			service: "X",
			field: "X_IDS" as const,
			text: `@${id}`,
			href: `https://x.com/${id}`,
		})),
		...info.instagramIds.map(id => ({
			service: "Instagram",
			field: "INSTAGRAM_IDS" as const,
			text: id,
			href: `https://www.instagram.com/${id}`,
		})),
		...info.youtubeIds.map(id => ({
			service: "YouTube",
			field: "YOUTUBE_IDS" as const,
			text: `@${id}`,
			href: `https://www.youtube.com/@${id}`,
		})),
	];
}

function escapeCsvField(str: string): string {
	// 引用符で囲むだけでは数式として評価されるため、先に文字列化する。
	const value = /^(?:\s*[=+\-@]|[\t\r\n])/.test(str) ? `'${str}` : str;
	if (/[,"\r\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function downloadPublicInfoCsv(projects: CommitteeProjectPublicInfo[]) {
	const headers = [
		"企画番号",
		"企画名",
		"企画団体名",
		"入力状況",
		"紹介文",
		"アイコン",
		"詳細画像",
		"Webサイト",
		"X",
		"Instagram",
		"YouTube",
		"開店状態",
		"在庫状態",
	];

	// 1セルに複数の値が入る項目は改行区切りにする
	const rows = projects.map(
		({ number, name, organizationName, publicInfo }) => [
			formatProjectNumber(number),
			name,
			organizationName,
			publicInfo ? "入力済み" : "未入力",
			publicInfo?.description ?? "",
			publicInfo?.iconFileId ? getFileContentUrl(publicInfo.iconFileId) : "",
			publicInfo?.mapImageFileIds.map(getFileContentUrl).join("\n") ?? "",
			publicInfo?.websiteUrls.join("\n") ?? "",
			publicInfo?.xIds.map(id => `https://x.com/${id}`).join("\n") ?? "",
			publicInfo?.instagramIds
				.map(id => `https://www.instagram.com/${id}`)
				.join("\n") ?? "",
			publicInfo?.youtubeIds
				.map(id => `https://www.youtube.com/@${id}`)
				.join("\n") ?? "",
			(publicInfo && OPEN_STATUS_LABELS[publicInfo.openStatus]) ?? "",
			(publicInfo && STOCK_STATUS_LABELS[publicInfo.stockStatus]) ?? "",
		]
	);

	// Excel で文字化けしないよう BOM を付ける
	const csv =
		"﻿" +
		[headers, ...rows]
			.map(row => row.map(escapeCsvField).join(","))
			.join("\r\n");

	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "企画情報一覧.csv";
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function PublicInfoListPage() {
	const { projects: loadedProjects } = Route.useLoaderData();
	// 非表示・修正の結果をそのまま一覧に反映するため、手元で持つ
	const [projects, setProjects] = useState(loadedProjects);
	const [loadedFrom, setLoadedFrom] = useState(loadedProjects);
	if (loadedFrom !== loadedProjects) {
		setLoadedFrom(loadedProjects);
		setProjects(loadedProjects);
	}
	const [preview, setPreview] = useState<Preview | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const editingProject = projects.find(p => p.id === editingId) ?? null;
	const { permissions } = useAuthStore();
	const canEdit = permissions?.has("MAP_APP_SETTING_EDIT") ?? false;

	return (
		<div>
			<div className={styles.header}>
				<div>
					<Heading size="6">企画情報一覧</Heading>
					<Text size="2" color="gray">
						各企画が「企画情報」ページで入力した内容です。
					</Text>
				</div>
				<Button
					intent="secondary"
					onClick={() => downloadPublicInfoCsv(projects)}
				>
					<IconDownload size={16} />
					CSVダウンロード
				</Button>
			</div>

			<div className={styles.list}>
				{projects.map(project => (
					<ProjectCard
						key={project.id}
						project={project}
						onPreview={setPreview}
						onEdit={canEdit ? () => setEditingId(project.id) : undefined}
					/>
				))}
			</div>

			<ImagePreviewModal
				isOpen={preview !== null}
				onOpenChange={open => {
					if (!open) setPreview(null);
				}}
				fileIds={preview?.fileIds ?? []}
				currentIndex={preview?.index ?? 0}
				onChangeIndex={index => setPreview(prev => prev && { ...prev, index })}
			/>

			{editingProject && (
				<PublicInfoDetailDialog
					open
					onOpenChange={open => {
						if (!open) setEditingId(null);
					}}
					item={editingProject}
					onItemChange={updated =>
						setProjects(current =>
							current.map(p => (p.id === updated.id ? updated : p))
						)
					}
				/>
			)}
		</div>
	);
}

function ProjectCard({
	project,
	onPreview,
	onEdit,
}: {
	project: CommitteeProjectPublicInfo;
	onPreview: (preview: Preview) => void;
	/** 非表示・修正の権限がある場合のみ渡す */
	onEdit?: () => void;
}) {
	const info = project.publicInfo;
	const openLabel = info && OPEN_STATUS_LABELS[info.openStatus];
	const stockLabel = info && STOCK_STATUS_LABELS[info.stockStatus];
	const links = info ? snsLinks(info) : [];
	const isIconHidden = !!findModeration(project, "ICON", "HIDDEN");
	const isIconCorrected = !!findModeration(project, "ICON", "CORRECTED");

	return (
		<Card className={styles.card}>
			<div className={styles.cardHeader}>
				<button
					type="button"
					className={styles.imageButton}
					onClick={() => {
						if (info?.iconFileId) {
							onPreview({ fileIds: [info.iconFileId], index: 0 });
						}
					}}
					disabled={!info?.iconFileId}
					aria-label="アイコンを拡大"
				>
					<span className={styles.imageWrap}>
						<UserAvatar
							size={56}
							name={project.name}
							avatarFileId={info?.iconFileId ?? null}
						/>
						{isIconHidden && info?.iconFileId ? (
							<StatusOverlay label="非表示" color="red" />
						) : (
							isIconCorrected && <StatusOverlay label="修正" color="blue" />
						)}
					</span>
				</button>
				<div>
					<Text as="div" size="1" color="gray">
						{formatProjectNumber(project.number)}
					</Text>
					<Text as="div" size="3" weight="bold">
						{project.name}
					</Text>
					<Text as="div" size="2" color="gray">
						{project.organizationName}
					</Text>
				</div>
				<div className={styles.badges}>
					{openLabel && <Badge>{openLabel}</Badge>}
					{stockLabel && <Badge color="gray">{stockLabel}</Badge>}
					{onEdit && info && (
						<Button intent="secondary" size="1" onClick={onEdit}>
							<IconEdit size={16} />
							非表示・修正
						</Button>
					)}
				</div>
			</div>

			{!info ? (
				<Text size="2" color="gray">
					未入力
				</Text>
			) : (
				<div className={styles.body}>
					{info.description && (
						<div>
							<div className={styles.fieldBadges}>
								<FieldStatusBadges item={project} field="DESCRIPTION" />
							</div>
							<Text as="p" size="2" className={styles.description}>
								{info.description}
							</Text>
						</div>
					)}

					{links.length > 0 && (
						<div className={styles.links}>
							{links.map(link => (
								<Text key={link.href} size="2" className={styles.link}>
									<Text color="gray">{link.service}: </Text>
									<Link
										href={link.href}
										target="_blank"
										rel="noopener noreferrer"
									>
										{link.text}
									</Link>{" "}
									<FieldStatusBadges item={project} field={link.field} />
								</Text>
							))}
						</div>
					)}

					{info.mapImageFileIds.length > 0 && (
						<div className={styles.fieldBadges}>
							<FieldStatusBadges item={project} field="MAP_IMAGES" />
						</div>
					)}
					{info.mapImageFileIds.length > 0 && (
						<div className={styles.thumbs}>
							{info.mapImageFileIds.map((fileId, index) => (
								<button
									key={fileId}
									type="button"
									className={styles.imageButton}
									onClick={() =>
										onPreview({ fileIds: info.mapImageFileIds, index })
									}
									aria-label={`詳細画像 ${index + 1} を拡大`}
								>
									<span className={styles.imageWrap}>
										<img
											src={getFileContentUrl(fileId)}
											alt={`詳細画像 ${index + 1}`}
											className={styles.thumb}
										/>
										{project.hiddenMapImageFileIds.includes(fileId) && (
											<StatusOverlay label="非表示" color="red" />
										)}
									</span>
								</button>
							))}
						</div>
					)}
				</div>
			)}
		</Card>
	);
}

function StatusOverlay({
	label,
	color,
}: {
	label: string;
	color: "red" | "blue";
}) {
	return (
		<Badge
			color={color}
			variant="solid"
			size="1"
			className={styles.hiddenBadge}
		>
			{label}
		</Badge>
	);
}
