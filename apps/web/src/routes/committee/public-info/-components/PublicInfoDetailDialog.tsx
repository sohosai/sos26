import {
	Badge,
	Box,
	Callout,
	Dialog,
	DropdownMenu,
	Flex,
	Heading,
	Link,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import type {
	CommitteeProjectPublicInfo,
	CorrectCommitteePublicInfoRequest,
	HideableProjectPublicInfoField,
	ProjectPublicInfo,
	ProjectPublicInfoField,
	ProjectSnsLinkKey,
} from "@sos26/shared";
import {
	allowedImageExtensions,
	imageAcceptAttribute,
	isAllowedImageFile,
	PROJECT_DESCRIPTION_MAX_LENGTH,
	PROJECT_MAP_IMAGES_MAX_COUNT,
	PROJECT_SNS_LINKS_MAX_COUNT,
	projectSnsLinkInputSchemas,
} from "@sos26/shared";
import { IconDotsVertical, IconPlus } from "@tabler/icons-react";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button, Switch, TextArea, TextField } from "@/components/primitives";
import {
	correctCommitteePublicInfo,
	hideCommitteePublicInfoField,
	revertCommitteePublicInfoCorrection,
	unhideCommitteePublicInfoField,
	updateCommitteePublicInfoMapImage,
} from "@/lib/api/committee-public-info";
import { getFileContentUrl, uploadFile } from "@/lib/api/files";
import { reportHandledError } from "@/lib/error/report";
import { formatDate, formatProjectNumber } from "@/lib/format";
import { ImageCropperModal } from "../../../project/public-info/ImageCropperModal";
import { ImagePreviewModal } from "../../../project/public-info/ImagePreviewModal";
import styles from "./PublicInfoDetailDialog.module.scss";
import { findModeration, SNS_FIELDS } from "./shared";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: CommitteeProjectPublicInfo;
	onItemChange: (item: CommitteeProjectPublicInfo) => void;
};

/** 編集中の項目と入力値 */
type Editing =
	| { field: "DESCRIPTION"; value: string }
	| { field: ProjectPublicInfoField; key: ProjectSnsLinkKey; values: string[] };

function getSnsLinkError(key: ProjectSnsLinkKey, value: string) {
	if (value === "") return undefined;
	const result = projectSnsLinkInputSchemas[key].safeParse(value);
	return result.success ? undefined : result.error.issues[0]?.message;
}

/** 掲載画像として追加できないファイルなら、その理由を返す */
function getMapImagesError(files: File[], currentCount: number) {
	if (files.some(file => !isAllowedImageFile(file))) {
		return `画像ファイルのみアップロードできます（${allowedImageExtensions}）。`;
	}
	if (currentCount + files.length > PROJECT_MAP_IMAGES_MAX_COUNT) {
		return `掲載画像は最大${PROJECT_MAP_IMAGES_MAX_COUNT}枚までです。`;
	}
	return undefined;
}

function operatorText(m: { updatedBy: { name: string }; updatedAt: Date }) {
	return `${m.updatedBy.name}（${formatDate(m.updatedAt, "datetime")}）`;
}

/**
 * 1つの項目の枠。見出しの右に公開スイッチ、見出しの下に非公開・修正の記録、
 * 本文の下に修正前の企画の入力を出す。
 * 公開スイッチは項目単位で非公開にできる項目だけに出す。
 */
function FieldSection({
	item,
	field,
	title,
	headerAction,
	visibility,
	correction,
	children,
}: {
	item: CommitteeProjectPublicInfo;
	field: ProjectPublicInfoField;
	title: string;
	headerAction?: ReactNode;
	visibility?: { onToggle: () => void; disabled: boolean } | null;
	correction: ReactNode;
	children: ReactNode;
}) {
	const hidden = findModeration(item, field, "HIDDEN");
	const corrected = findModeration(item, field, "CORRECTED");
	return (
		<section className={styles.section}>
			<Flex justify="between" align="center" gap="2" wrap="wrap">
				<Heading size="3">{title}</Heading>
				{visibility && (
					<Switch
						label="公開"
						size="1"
						checked={!hidden}
						onCheckedChange={visibility.onToggle}
						disabled={visibility.disabled}
					/>
				)}
				{headerAction}
			</Flex>
			{hidden && (
				<Text size="1" color="red">
					{operatorText(hidden)}が非公開にしました
				</Text>
			)}
			{corrected && (
				<Text size="1" color="blue">
					{operatorText(corrected)}が修正しました
				</Text>
			)}
			{children}
			{correction}
		</section>
	);
}

/** 実行委員会が修正した項目に、修正前の企画の入力と「企画の入力に戻す」を出す */
function CorrectionNotice({
	item,
	field,
	onRevert,
	disabled,
}: {
	item: CommitteeProjectPublicInfo;
	field: ProjectPublicInfoField;
	onRevert: () => void;
	disabled: boolean;
}) {
	const correction = findModeration(item, field, "CORRECTED");
	if (!correction) return null;
	const value = correction.previousValue;
	const values = Array.isArray(value) ? value : value ? [value] : [];
	const isImage = field === "ICON" || field === "MAP_IMAGES";
	return (
		<div className={styles.correction}>
			<Flex justify="between" align="end" gap="3" wrap="wrap">
				<Flex direction="column" gap="1">
					<Text size="1" color="gray">
						企画の入力
					</Text>
					{values.length === 0 ? (
						<Text size="2">{isImage ? "（未設定）" : "（未入力）"}</Text>
					) : isImage ? (
						<Flex gap="2" wrap="wrap">
							{values.map((fileId, index) => (
								<img
									key={fileId}
									src={getFileContentUrl(fileId)}
									alt={`企画が設定した画像 ${index + 1}`}
									className={styles.previousImage}
								/>
							))}
						</Flex>
					) : (
						<Text size="2" className={styles.value}>
							{values.join("\n")}
						</Text>
					)}
				</Flex>
				<Button
					intent="secondary"
					size="1"
					onClick={onRevert}
					disabled={disabled}
				>
					企画の入力に戻す
				</Button>
			</Flex>
		</div>
	);
}

/** 画像を選んでトリミングし、トリミング後の画像を渡すボタン */
function IconChangeButton({
	onCropped,
	disabled,
}: {
	onCropped: (blob: Blob) => void;
	disabled: boolean;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [imageSrc, setImageSrc] = useState<string | null>(null);

	const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		if (!isAllowedImageFile(file)) {
			toast.error(
				`画像ファイルを選択してください（${allowedImageExtensions}）。`
			);
			return;
		}
		const reader = new FileReader();
		reader.onload = () => setImageSrc(reader.result?.toString() ?? "");
		reader.readAsDataURL(file);
	};

	return (
		<>
			<Button
				intent="secondary"
				size="1"
				onClick={() => inputRef.current?.click()}
				disabled={disabled}
			>
				画像を変更
			</Button>
			<input
				ref={inputRef}
				type="file"
				accept={imageAcceptAttribute}
				hidden
				onChange={handleSelect}
			/>
			<ImageCropperModal
				isOpen={imageSrc !== null}
				onOpenChange={open => {
					if (!open) setImageSrc(null);
				}}
				imageSrc={imageSrc ?? ""}
				onCropComplete={blob => {
					setImageSrc(null);
					onCropped(blob);
				}}
			/>
		</>
	);
}

/** 掲載画像1枚。「…」メニューから非公開の切り替えと削除をする */
function MapImageTile({
	fileId,
	index,
	isHidden,
	onPreview,
	onToggleHidden,
	onDelete,
	disabled,
}: {
	fileId: string;
	index: number;
	isHidden: boolean;
	onPreview: () => void;
	onToggleHidden: () => void;
	onDelete: () => void;
	disabled: boolean;
}) {
	return (
		<div className={styles.imageTile}>
			<button
				type="button"
				onClick={onPreview}
				className={styles.imageLink}
				aria-label={`掲載画像 ${index + 1} を拡大`}
			>
				<img
					src={getFileContentUrl(fileId)}
					alt={`掲載画像 ${index + 1}`}
					className={`${styles.image} ${isHidden ? styles.imageHidden : ""}`}
				/>
				{isHidden && (
					<Badge color="red" variant="solid" className={styles.imageBadge}>
						非公開
					</Badge>
				)}
			</button>
			<div className={styles.imageMenu}>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger disabled={disabled}>
						<button
							type="button"
							className={styles.imageMenuButton}
							aria-label={`掲載画像 ${index + 1} の操作`}
						>
							<IconDotsVertical size={16} />
						</button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content size="1">
						<DropdownMenu.Item onClick={onToggleHidden}>
							{isHidden ? "公開する" : "非公開にする"}
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item color="red" onClick={onDelete}>
							削除
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>
	);
}

/** 掲載画像の一覧。画像を押すと拡大表示する */
function MapImageGrid({
	fileIds,
	hiddenFileIds,
	onToggleHidden,
	onDelete,
	disabled,
}: {
	fileIds: string[];
	hiddenFileIds: string[];
	onToggleHidden: (fileId: string) => void;
	onDelete: (fileId: string) => void;
	disabled: boolean;
}) {
	const [previewIndex, setPreviewIndex] = useState<number | null>(null);

	return (
		<>
			<div className={styles.imageGrid}>
				{fileIds.map((fileId, index) => (
					<MapImageTile
						key={fileId}
						fileId={fileId}
						index={index}
						isHidden={hiddenFileIds.includes(fileId)}
						onPreview={() => setPreviewIndex(index)}
						onToggleHidden={() => onToggleHidden(fileId)}
						onDelete={() => onDelete(fileId)}
						disabled={disabled}
					/>
				))}
			</div>
			<ImagePreviewModal
				isOpen={previewIndex !== null}
				onOpenChange={open => {
					if (!open) setPreviewIndex(null);
				}}
				fileIds={fileIds}
				currentIndex={previewIndex ?? 0}
				onChangeIndex={setPreviewIndex}
			/>
		</>
	);
}

const EMPTY_PUBLIC_INFO: ProjectPublicInfo = {
	description: null,
	iconFileId: null,
	mapImageFileIds: [],
	websiteUrls: [],
	xIds: [],
	instagramIds: [],
	youtubeIds: [],
	openStatus: "NOT_APPLICABLE",
	stockStatus: "NOT_APPLICABLE",
};

export function PublicInfoDetailDialog({
	open,
	onOpenChange,
	item,
	onItemChange,
}: Props) {
	const [isBusy, setIsBusy] = useState(false);
	const [editing, setEditing] = useState<Editing | null>(null);
	const mapImageInputRef = useRef<HTMLInputElement>(null);
	// 企画情報が未登録の企画は空の値として表示し、値を追加できるようにする
	const publicInfo = item.publicInfo ?? EMPTY_PUBLIC_INFO;
	const { mapImageFileIds } = publicInfo;

	const run = async (
		operation: () => Promise<{ project: CommitteeProjectPublicInfo }>,
		successMessage: string
	) => {
		setIsBusy(true);
		try {
			const res = await operation();
			onItemChange(res.project);
			toast.success(successMessage);
			return true;
		} catch (error) {
			reportHandledError({
				error,
				operation: "update_committee_public_info",
				userMessage: "更新に失敗しました。",
				ui: { type: "toast" },
				context: { projectId: item.id },
			});
			return false;
		} finally {
			setIsBusy(false);
		}
	};

	const correct = (data: CorrectCommitteePublicInfoRequest, message: string) =>
		run(() => correctCommitteePublicInfo(item.id, data), message);

	const handleIconCropped = (blob: Blob) => {
		void run(async () => {
			const res = await uploadFile(
				new File([blob], "icon.png", { type: "image/png" }),
				{ isPublic: true }
			);
			return correctCommitteePublicInfo(item.id, { iconFileId: res.file.id });
		}, "アイコンを変更しました。");
	};

	const handleMapImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files ?? []);
		e.target.value = "";
		if (files.length === 0) return;
		const error = getMapImagesError(files, mapImageFileIds.length);
		if (error) {
			toast.error(error);
			return;
		}
		void run(async () => {
			const results = await Promise.all(
				files.map(file => uploadFile(file, { isPublic: true }))
			);
			return correctCommitteePublicInfo(item.id, {
				mapImageFileIds: [
					...mapImageFileIds,
					...results.map(res => res.file.id),
				],
			});
		}, `${files.length}枚の画像を追加しました。`);
	};

	// 企画情報が未登録の間は、非公開にする対象がないためスイッチを出さない
	const visibility = (field: HideableProjectPublicInfoField) =>
		item.publicInfo && {
			disabled: isBusy,
			onToggle: () => {
				const isHidden = !!findModeration(item, field, "HIDDEN");
				void run(
					() =>
						isHidden
							? unhideCommitteePublicInfoField(item.id, field)
							: hideCommitteePublicInfoField(item.id, field),
					isHidden ? "公開しました。" : "非公開にしました。"
				);
			},
		};

	const toggleMapImage = (fileId: string) => {
		const isHidden = item.hiddenMapImageFileIds.includes(fileId);
		void run(
			() => updateCommitteePublicInfoMapImage(item.id, fileId, !isHidden),
			isHidden ? "画像を公開しました。" : "画像を非公開にしました。"
		);
	};

	const saveEditing = async () => {
		if (!editing) return;
		const data: CorrectCommitteePublicInfoRequest =
			"key" in editing
				? { [editing.key]: editing.values.filter(v => v !== "") }
				: { description: editing.value };
		const ok = await correct(data, "保存しました。");
		if (ok) setEditing(null);
	};

	const correction = (field: ProjectPublicInfoField) => (
		<CorrectionNotice
			item={item}
			field={field}
			disabled={isBusy}
			onRevert={() =>
				void run(
					() => revertCommitteePublicInfoCorrection(item.id, field),
					"企画の入力に戻しました。"
				)
			}
		/>
	);

	/** 値の右に「編集」を並べる */
	const valueWithEdit = (value: ReactNode, onEdit: () => void) => (
		<Flex justify="between" align="start" gap="3">
			{value}
			<Box flexShrink="0">
				<Button intent="secondary" size="1" onClick={onEdit} disabled={isBusy}>
					編集
				</Button>
			</Box>
		</Flex>
	);

	const editActions = (canSave: boolean) => (
		<Flex gap="2" justify="end">
			<Button
				intent="secondary"
				size="1"
				onClick={() => setEditing(null)}
				disabled={isBusy}
			>
				キャンセル
			</Button>
			<Button
				size="1"
				onClick={saveEditing}
				loading={isBusy}
				disabled={!canSave}
			>
				保存
			</Button>
		</Flex>
	);

	const editingSnsErrors =
		editing && "key" in editing
			? editing.values.map(v => getSnsLinkError(editing.key, v))
			: [];

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="720px">
				<Dialog.Title>
					{formatProjectNumber(item.number)} {item.name}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray" mb="4">
					{item.organizationName}
				</Dialog.Description>

				{item.publicInfo === null && (
					<Callout.Root color="gray" mb="4">
						<Callout.Text>
							この企画はまだ企画情報を入力していません。ここで値を追加できます。
						</Callout.Text>
					</Callout.Root>
				)}

				<Flex direction="column" gap="5">
					<FieldSection
						item={item}
						field="DESCRIPTION"
						title="紹介文"
						visibility={visibility("DESCRIPTION")}
						correction={correction("DESCRIPTION")}
					>
						{editing && !("key" in editing) ? (
							<Flex direction="column" gap="2">
								<TextArea
									label={`紹介文（${PROJECT_DESCRIPTION_MAX_LENGTH}文字以内）`}
									value={editing.value}
									onChange={value =>
										setEditing({
											field: "DESCRIPTION",
											value: value.slice(0, PROJECT_DESCRIPTION_MAX_LENGTH),
										})
									}
									rows={4}
								/>
								<Text size="1" color="gray" align="right">
									{editing.value.length}/{PROJECT_DESCRIPTION_MAX_LENGTH}
								</Text>
								{editActions(true)}
							</Flex>
						) : (
							valueWithEdit(
								<Text size="2" className={styles.value}>
									{publicInfo.description || "（未入力）"}
								</Text>,
								() =>
									setEditing({
										field: "DESCRIPTION",
										value: publicInfo.description ?? "",
									})
							)
						)}
					</FieldSection>

					<FieldSection
						item={item}
						field="ICON"
						title="アイコン"
						visibility={visibility("ICON")}
						correction={correction("ICON")}
					>
						<Flex justify="between" align="end" gap="2" wrap="wrap">
							{publicInfo.iconFileId ? (
								<UserAvatar
									size={64}
									name={item.name}
									avatarFileId={publicInfo.iconFileId}
								/>
							) : (
								<Text size="2" color="gray">
									（未設定）
								</Text>
							)}
							<Flex gap="2">
								<IconChangeButton
									onCropped={handleIconCropped}
									disabled={isBusy}
								/>
								{publicInfo.iconFileId && (
									<Button
										intent="secondary"
										size="1"
										onClick={() =>
											void correct(
												{ iconFileId: null },
												"アイコンを削除しました。"
											)
										}
										disabled={isBusy}
									>
										削除
									</Button>
								)}
							</Flex>
						</Flex>
					</FieldSection>

					<FieldSection
						item={item}
						field="MAP_IMAGES"
						title="掲載画像"
						headerAction={
							<>
								<Button
									intent="secondary"
									size="1"
									onClick={() => mapImageInputRef.current?.click()}
									disabled={
										isBusy ||
										mapImageFileIds.length >= PROJECT_MAP_IMAGES_MAX_COUNT
									}
								>
									<IconPlus size={14} />
									追加
								</Button>
								<input
									ref={mapImageInputRef}
									type="file"
									accept={imageAcceptAttribute}
									multiple
									hidden
									onChange={handleMapImagesSelect}
								/>
							</>
						}
						correction={correction("MAP_IMAGES")}
					>
						{mapImageFileIds.length === 0 ? (
							<Text size="2" color="gray">
								（未設定）
							</Text>
						) : (
							<MapImageGrid
								fileIds={mapImageFileIds}
								hiddenFileIds={item.hiddenMapImageFileIds}
								onToggleHidden={toggleMapImage}
								onDelete={fileId =>
									void correct(
										{
											mapImageFileIds: mapImageFileIds.filter(
												id => id !== fileId
											),
										},
										"画像を削除しました。"
									)
								}
								disabled={isBusy}
							/>
						)}
					</FieldSection>

					{SNS_FIELDS.map(({ key, field, label, toHref }) => (
						<FieldSection
							key={key}
							item={item}
							field={field}
							title={label}
							visibility={visibility(field)}
							correction={correction(field)}
						>
							{editing && "key" in editing && editing.key === key ? (
								<Flex direction="column" gap="2">
									{editing.values.map((value, index) => (
										<TextField
											// biome-ignore lint/suspicious/noArrayIndexKey: 入力欄の数は固定
											key={index}
											type={key === "websiteUrls" ? "url" : "text"}
											label={`${label} ${index + 1}つ目`}
											value={value}
											onChange={next =>
												setEditing({
													...editing,
													values: editing.values.map((v, i) =>
														i === index ? next.trim() : v
													),
												})
											}
											error={editingSnsErrors[index]}
										/>
									))}
									{editActions(editingSnsErrors.every(e => e === undefined))}
								</Flex>
							) : (
								valueWithEdit(
									publicInfo[key].length > 0 ? (
										<Flex direction="column" gap="1" minWidth="0">
											{publicInfo[key].map(value => (
												<Tooltip key={value} content={value}>
													<Link
														href={toHref(value)}
														target="_blank"
														rel="noopener noreferrer"
														size="2"
														truncate
													>
														{value}
													</Link>
												</Tooltip>
											))}
										</Flex>
									) : (
										<Text size="2" color="gray">
											（未入力）
										</Text>
									),
									() =>
										setEditing({
											field,
											key,
											values: Array.from(
												{ length: PROJECT_SNS_LINKS_MAX_COUNT },
												(_, i) => publicInfo[key][i] ?? ""
											),
										})
								)
							)}
						</FieldSection>
					))}
				</Flex>

				<Flex justify="end" mt="5">
					<Dialog.Close>
						<Button intent="secondary">閉じる</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
