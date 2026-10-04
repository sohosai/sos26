import { Badge, Card, Heading, Link, Text } from "@radix-ui/themes";
import type {
	ListCommitteeProjectPublicInfosResponse,
	OpenStatus,
	StockStatus,
} from "@sos26/shared";
import { IconDownload } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/primitives";
import { getFileContentUrl } from "@/lib/api/files";
import { listCommitteeProjectPublicInfos } from "@/lib/api/project-public-info";
import { formatProjectNumber } from "@/lib/format";
import { ImagePreviewModal } from "../../project/public-info/ImagePreviewModal";
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

type PublicInfo = NonNullable<
	ListCommitteeProjectPublicInfosResponse["projects"][number]["publicInfo"]
>;

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

function snsLinks(
	info: PublicInfo
): { service: string; text: string; href: string }[] {
	return [
		...info.websiteUrls.map(url => ({
			service: "Website",
			text: url,
			href: url,
		})),
		...info.xIds.map(id => ({
			service: "X",
			text: `@${id}`,
			href: `https://x.com/${id}`,
		})),
		...info.instagramIds.map(id => ({
			service: "Instagram",
			text: id,
			href: `https://www.instagram.com/${id}`,
		})),
		...info.youtubeIds.map(id => ({
			service: "YouTube",
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

function downloadPublicInfoCsv(
	projects: ListCommitteeProjectPublicInfosResponse["projects"]
) {
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
	const { projects } = Route.useLoaderData();
	const [preview, setPreview] = useState<Preview | null>(null);

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
		</div>
	);
}

function ProjectCard({
	project,
	onPreview,
}: {
	project: ListCommitteeProjectPublicInfosResponse["projects"][number];
	onPreview: (preview: Preview) => void;
}) {
	const info = project.publicInfo;
	const openLabel = info && OPEN_STATUS_LABELS[info.openStatus];
	const stockLabel = info && STOCK_STATUS_LABELS[info.stockStatus];
	const links = info ? snsLinks(info) : [];

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
					<UserAvatar
						size={56}
						name={project.name}
						avatarFileId={info?.iconFileId ?? null}
					/>
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
				</div>
			</div>

			{!info ? (
				<Text size="2" color="gray">
					未入力
				</Text>
			) : (
				<div className={styles.body}>
					{info.description && (
						<Text as="p" size="2" className={styles.description}>
							{info.description}
						</Text>
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
									</Link>
								</Text>
							))}
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
									<img
										src={getFileContentUrl(fileId)}
										alt={`詳細画像 ${index + 1}`}
										className={styles.thumb}
									/>
								</button>
							))}
						</div>
					)}
				</div>
			)}
		</Card>
	);
}
