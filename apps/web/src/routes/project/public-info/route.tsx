import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
	arrayMove,
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
	Button,
	Card,
	Flex,
	Heading,
	Select,
	Text,
	TextArea,
} from "@radix-ui/themes";
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import BoringAvatar from "boring-avatars";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getFileContentUrl, uploadFile } from "@/lib/api/files";
import { getMapAppSetting } from "@/lib/api/map-app-setting";
import {
	getProjectPublicInfo,
	updateProjectPublicInfo,
} from "@/lib/api/project-public-info";
import { useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
import { useProjectStore } from "@/lib/project/store";
import { ImageCropperModal } from "./ImageCropperModal";
import { ImagePreviewModal } from "./ImagePreviewModal";
import styles from "./route.module.scss";
import { SortableMapImageItem } from "./SortableMapImageItem";

export const Route = createFileRoute("/project/public-info")({
	loader: async () => {
		const projectId = useProjectStore.getState().selectedProjectId;
		if (!projectId) throw new Error("No project selected");
		const [infoRes, settingRes] = await Promise.all([
			getProjectPublicInfo(projectId),
			getMapAppSetting(),
		]);
		return {
			publicInfo: infoRes.publicInfo,
			setting: settingRes.setting,
		};
	},
	component: ProjectPublicInfoPage,
});

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy code
function ProjectPublicInfoPage() {
	const router = useRouter();
	const { user } = useAuthStore();
	const { projects, selectedProjectId } = useProjectStore();
	const { setIconFileId: saveProjectIconFileId } = useProjectStore.getState();
	const project = projects.find(p => p.id === selectedProjectId);
	const projectRole =
		project?.ownerId === user?.id
			? "OWNER"
			: project?.subOwnerId === user?.id
				? "SUB_OWNER"
				: "MEMBER";

	const { publicInfo, setting } = Route.useLoaderData();

	const [description, setDescription] = useState(publicInfo?.description ?? "");
	const [iconFileId, setIconFileId] = useState(publicInfo?.iconFileId ?? "");
	const [mapImageFileIds, setMapImageFileIds] = useState<string[]>(
		publicInfo?.mapImageFileIds ?? []
	);
	const [openStatus, setOpenStatus] = useState(
		publicInfo?.openStatus ?? "NOT_APPLICABLE"
	);
	const [stockStatus, setStockStatus] = useState(
		publicInfo?.stockStatus ?? "NOT_APPLICABLE"
	);

	const [isSaving, setIsSaving] = useState(false);
	const [isUploadingMapImages, setIsUploadingMapImages] = useState(false);
	const [uploadingCount, setUploadingCount] = useState(0);

	const [cropImageSrc, setCropImageSrc] = useState("");
	const [isCropModalOpen, setIsCropModalOpen] = useState(false);

	useEffect(() => {
		if (publicInfo) {
			setDescription(publicInfo.description ?? "");
			setIconFileId(publicInfo.iconFileId ?? "");
			setMapImageFileIds(publicInfo.mapImageFileIds ?? []);
			setOpenStatus(publicInfo.openStatus ?? "NOT_APPLICABLE");
			setStockStatus(publicInfo.stockStatus ?? "NOT_APPLICABLE");
		}
	}, [publicInfo]);

	// プレビューモーダル
	const [isPreviewOpen, setIsPreviewOpen] = useState(false);
	const [previewIndex, setPreviewIndex] = useState(0);

	const iconInputRef = useRef<HTMLInputElement>(null);
	const mapImagesInputRef = useRef<HTMLInputElement>(null);

	const isEditable = projectRole === "OWNER" || projectRole === "SUB_OWNER";

	const isUnsaved =
		description !== (publicInfo?.description ?? "") ||
		iconFileId !== (publicInfo?.iconFileId ?? "") ||
		openStatus !== (publicInfo?.openStatus ?? "NOT_APPLICABLE") ||
		stockStatus !== (publicInfo?.stockStatus ?? "NOT_APPLICABLE") ||
		JSON.stringify(mapImageFileIds) !==
			JSON.stringify(publicInfo?.mapImageFileIds ?? []);

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: handleSave needs to perform several checks
	const handleSave = async () => {
		if (!project?.id) return;
		try {
			setIsSaving(true);
			await updateProjectPublicInfo(project.id, {
				description: setting.isDescriptionEditable ? description : undefined,
				iconFileId: setting.isIconEditable ? iconFileId : undefined,
				mapImageFileIds: setting.isMapImagesEditable
					? mapImageFileIds
					: undefined,
				openStatus: setting.isOpenStatusEditable
					? (openStatus as "OPEN" | "CLOSED" | "NOT_APPLICABLE")
					: undefined,
				stockStatus: setting.isStockStatusEditable
					? (stockStatus as "IN_STOCK" | "OUT_OF_STOCK" | "NOT_APPLICABLE")
					: undefined,
			});
			toast.success("企画情報が更新されました。");
			// ストアのアイコンも即時更新してサイドバーに反映
			if (setting.isIconEditable) {
				if (iconFileId) {
					saveProjectIconFileId(project.id, iconFileId);
				} else {
					// 空文字 = アイコン削除 → ストアからも消す
					saveProjectIconFileId(project.id, "");
				}
			}
			await router.invalidate();
		} catch (error) {
			reportHandledError({
				error,
				operation: "update_project_public_info",
				userMessage: "保存に失敗しました。",
				ui: { type: "toast" },
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			setCropImageSrc(reader.result?.toString() ?? "");
			setIsCropModalOpen(true);
		};
		reader.readAsDataURL(file);
		e.target.value = "";
	};

	const handleCropComplete = async (blob: Blob) => {
		try {
			const res = await uploadFile(
				new File([blob], "icon.png", { type: "image/png" }),
				{ isPublic: true }
			);
			setIconFileId(res.file.id);
		} catch (error) {
			reportHandledError({
				error,
				operation: "save",
				userMessage: "アイコンのアップロードに失敗しました。",
				ui: { type: "toast" },
			});
		}
	};

	const handleMapImagesUpload = async (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const files = Array.from(e.target.files ?? []);
		if (!files.length) return;
		if (mapImageFileIds.length + files.length > 10) {
			toast.error("Map掲載画像は最大10枚までです");
			e.target.value = "";
			return;
		}

		try {
			setIsUploadingMapImages(true);
			setUploadingCount(files.length);
			const uploadPromises = files.map(file =>
				uploadFile(file, { isPublic: true })
			);
			const results = await Promise.all(uploadPromises);
			const newIds = results.map(r => r.file.id);
			setMapImageFileIds(prev => [...prev, ...newIds]);
			toast.success(`${files.length}枚の画像をアップロードしました。`);
		} catch (error) {
			console.error(error);
			toast.error("画像のアップロードに失敗しました。");
		} finally {
			setIsUploadingMapImages(false);
			setUploadingCount(0);
			e.target.value = "";
		}
	};

	const removeMapImage = (index: number) => {
		setMapImageFileIds(prev => prev.filter((_, i) => i !== index));
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			setMapImageFileIds(items => {
				const oldIndex = items.indexOf(active.id as string);
				const newIndex = items.indexOf(over.id as string);

				return arrayMove(items, oldIndex, newIndex);
			});
		}
	};

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const canAddMore =
		mapImageFileIds.length + uploadingCount < 10 &&
		isEditable &&
		setting.isMapImagesEditable;

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<Heading size="6">企画情報</Heading>
				<Text size="2" color="gray">
					設定した情報は「雙峰祭オンラインマップ」に公開されます。
				</Text>
			</div>

			<Card className={styles.card}>
				<Flex direction="column" gap="4">
					<div>
						<Heading size="4">紹介文</Heading>
						<Text color="gray" size="2">
							紹介文を設定します
						</Text>
					</div>
					<Flex direction="column" gap="2">
						<TextArea
							value={description}
							onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
								setDescription(e.target.value)
							}
							disabled={!isEditable || !setting.isDescriptionEditable}
							placeholder="400文字以内で入力してください"
							maxLength={400}
							rows={4}
						/>
						<Text size="1" color="gray" align="right">
							{description.length}/400
						</Text>
					</Flex>
				</Flex>
			</Card>

			<Card className={styles.card}>
				<Flex direction="column" gap="4">
					<div>
						<Heading size="4">アイコン画像</Heading>
						<Text size="2" color="gray">
							正方形にトリミングされて表示されます。
						</Text>
					</div>
					<input
						type="file"
						ref={iconInputRef}
						style={{ display: "none" }}
						accept="image/*"
						onChange={handleIconUpload}
					/>
					<Flex gap="4" align="center">
						{/* クリックで変更できるアバター */}
						<div className={styles.iconWrapper}>
							<button
								type="button"
								className={styles.iconButton}
								onClick={() =>
									isEditable &&
									setting.isIconEditable &&
									iconInputRef.current?.click()
								}
								disabled={!isEditable || !setting.isIconEditable}
								aria-label="アイコン画像を変更"
							>
								{iconFileId ? (
									<img
										src={getFileContentUrl(iconFileId)}
										alt="アイコン"
										className={styles.iconImg}
									/>
								) : (
									<BoringAvatar
										size={96}
										name={project?.id ?? "unknown"}
										variant="beam"
									/>
								)}
								{isEditable && setting.isIconEditable && (
									<span className={styles.iconOverlay}>
										<IconUpload size={20} color="white" />
										<span className={styles.iconOverlayLabel}>変更</span>
									</span>
								)}
							</button>
							{/* 削除バッジ */}
							{iconFileId && isEditable && setting.isIconEditable && (
								<button
									type="button"
									className={styles.iconDeleteBtn}
									onClick={() => setIconFileId("")}
									aria-label="アイコンをデフォルトに戻す"
								>
									<IconX size={12} />
								</button>
							)}
						</div>
						<Flex direction="column" gap="1">
							<Text size="2" weight="medium">
								{iconFileId ? "アイコンを変更する" : "アイコンを設定する"}
							</Text>
							<Text size="1" color="gray">
								{iconFileId
									? "画像をクリックするか、右上の × でデフォルトに戻せます"
									: "クリックして画像をアップロードしてください"}
							</Text>
						</Flex>
					</Flex>
				</Flex>
			</Card>

			<Card className={styles.card}>
				<Flex direction="column" gap="4">
					<div>
						<Heading size="4">Map掲載画像</Heading>
						<Text size="2" color="gray">
							オンラインマップに掲載される画像です（最大10枚）。ドラッグで並び替えできます。
						</Text>
					</div>
					<input
						type="file"
						multiple
						ref={mapImagesInputRef}
						style={{ display: "none" }}
						accept="image/*"
						onChange={handleMapImagesUpload}
					/>

					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
						modifiers={[restrictToParentElement]}
					>
						<SortableContext
							items={mapImageFileIds}
							strategy={rectSortingStrategy}
						>
							<div className={styles.mapImageGrid}>
								{mapImageFileIds.map((fileId, index) => (
									<SortableMapImageItem
										key={fileId}
										id={fileId}
										index={index}
										isEditable={isEditable && setting.isMapImagesEditable}
										onRemove={() => removeMapImage(index)}
										onPreview={() => {
											setPreviewIndex(index);
											setIsPreviewOpen(true);
										}}
									/>
								))}

								{/* アップロード中のスケルトン */}
								{isUploadingMapImages &&
									Array.from({ length: uploadingCount }).map((_, i) => (
										<div
											// biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
											key={`skeleton-${i}`}
											className={styles.mapImageSkeleton}
										>
											<IconPhoto size={24} className={styles.skeletonIcon} />
										</div>
									))}

								{/* 追加ボタン（グリッドの末尾） */}
								{canAddMore && (
									<button
										type="button"
										className={styles.mapImageAddCard}
										onClick={() => mapImagesInputRef.current?.click()}
										disabled={isUploadingMapImages}
										aria-label="画像を追加"
									>
										<IconUpload size={20} />
										<span>追加</span>
										<span className={styles.mapImageAddHint}>
											{10 - mapImageFileIds.length}枚まで追加可
										</span>
									</button>
								)}
							</div>
						</SortableContext>
					</DndContext>

					{/* 枚数インジケーター */}
					<Text size="1" color="gray">
						{mapImageFileIds.length} / 10 枚
					</Text>
				</Flex>
			</Card>

			{project?.type !== "STAGE" && (
				<>
					<Card className={styles.card}>
						<Flex direction="column" gap="4">
							<div>
								<Heading size="4">開店状態</Heading>
								<Text size="2" color="gray">
									現在の営業状態を設定します。
								</Text>
							</div>
							<div className={styles.fieldWithHelp}>
								<Select.Root
									value={
										!setting.isOpenStatusEditable
											? "NOT_APPLICABLE"
											: openStatus
									}
									onValueChange={(val: "OPEN" | "CLOSED" | "NOT_APPLICABLE") =>
										setOpenStatus(val)
									}
									disabled={!isEditable || !setting.isOpenStatusEditable}
								>
									<Select.Trigger />
									<Select.Content>
										<Select.Item value="OPEN">営業中</Select.Item>
										<Select.Item value="CLOSED">準備中・閉店</Select.Item>
										<Select.Item value="NOT_APPLICABLE">設定なし</Select.Item>
									</Select.Content>
								</Select.Root>
							</div>
						</Flex>
					</Card>

					<Card className={styles.card}>
						<Flex direction="column" gap="4">
							<div>
								<Heading size="4">在庫状態</Heading>
								<Text size="2" color="gray">
									現在の在庫状況を設定します。
								</Text>
							</div>
							<div className={styles.fieldWithHelp}>
								<Select.Root
									value={
										!setting.isStockStatusEditable
											? "NOT_APPLICABLE"
											: stockStatus
									}
									onValueChange={(
										val: "IN_STOCK" | "OUT_OF_STOCK" | "NOT_APPLICABLE"
									) => setStockStatus(val)}
									disabled={!isEditable || !setting.isStockStatusEditable}
								>
									<Select.Trigger />
									<Select.Content>
										<Select.Item value="IN_STOCK">在庫あり</Select.Item>
										<Select.Item value="OUT_OF_STOCK">
											在庫なし（完売）
										</Select.Item>
										<Select.Item value="NOT_APPLICABLE">設定なし</Select.Item>
									</Select.Content>
								</Select.Root>
							</div>
						</Flex>
					</Card>
				</>
			)}

			{isEditable && (
				<div style={{ maxWidth: 720 }}>
					<Flex justify="end" align="center" gap="3">
						{isUnsaved && (
							<Text size="2" color="blue" weight="bold">
								未保存の変更があります
							</Text>
						)}
						<Button
							size="3"
							onClick={handleSave}
							disabled={isSaving || !isUnsaved}
							color={isUnsaved ? "blue" : "gray"}
						>
							保存する
						</Button>
					</Flex>
				</div>
			)}

			<ImageCropperModal
				isOpen={isCropModalOpen}
				onOpenChange={setIsCropModalOpen}
				imageSrc={cropImageSrc}
				onCropComplete={handleCropComplete}
			/>

			<ImagePreviewModal
				isOpen={isPreviewOpen}
				onOpenChange={setIsPreviewOpen}
				fileIds={mapImageFileIds}
				initialIndex={previewIndex}
				currentIndex={previewIndex}
				onChangeIndex={setPreviewIndex}
			/>
		</div>
	);
}
