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
import { Callout, Card, Flex, Heading, Text } from "@radix-ui/themes";
import type {
	MapAppSetting,
	OpenStatus,
	Project,
	ProjectPublicInfo,
	StockStatus,
	UpdateProjectPublicInfoRequest,
} from "@sos26/shared";
import {
	allowedImageExtensions,
	imageAcceptAttribute,
	isAllowedImageFile,
} from "@sos26/shared";
import {
	IconInfoCircle,
	IconLock,
	IconPhoto,
	IconUpload,
	IconX,
} from "@tabler/icons-react";
import {
	createFileRoute,
	getRouteApi,
	useBlocker,
	useRouter,
} from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/common/UserAvatar";
import { DiscardChangesDialog } from "@/components/patterns";
import { Button, Select, TextArea } from "@/components/primitives";
import { uploadFile } from "@/lib/api/files";
import { getMapAppSetting } from "@/lib/api/map-app-setting";
import { updateProjectPublicInfo } from "@/lib/api/project-public-info";
import { useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
import { useProjectStore } from "@/lib/project/store";
import { ImageCropperModal } from "./ImageCropperModal";
import { ImagePreviewModal } from "./ImagePreviewModal";
import styles from "./route.module.scss";
import { SortableMapImageItem } from "./SortableMapImageItem";

const MAX_MAP_IMAGES = 10;
const DESCRIPTION_MAX_LENGTH = 400;

const projectRoute = getRouteApi("/project");

export const Route = createFileRoute("/project/public-info")({
	// 企画公開情報は親（/project）ローダーの取得結果を共用する
	loader: async () => {
		const { setting } = await getMapAppSetting();
		return { setting };
	},
	component: ProjectPublicInfoPage,
});

type FormValues = {
	description: string;
	iconFileId: string;
	mapImageFileIds: string[];
	openStatus: OpenStatus;
	stockStatus: StockStatus;
};

function toFormValues(info: ProjectPublicInfo | null): FormValues {
	return {
		description: info?.description ?? "",
		iconFileId: info?.iconFileId ?? "",
		mapImageFileIds: info?.mapImageFileIds ?? [],
		openStatus: info?.openStatus ?? "NOT_APPLICABLE",
		stockStatus: info?.stockStatus ?? "NOT_APPLICABLE",
	};
}

function isSameValues(a: FormValues, b: FormValues): boolean {
	return (
		a.description === b.description &&
		a.iconFileId === b.iconFileId &&
		a.openStatus === b.openStatus &&
		a.stockStatus === b.stockStatus &&
		a.mapImageFileIds.length === b.mapImageFileIds.length &&
		a.mapImageFileIds.every((id, i) => id === b.mapImageFileIds[i])
	);
}

/** 実委人が編集を許可している項目だけを送信する（禁止項目は undefined = 変更なし） */
function buildUpdateRequest(
	values: FormValues,
	setting: MapAppSetting,
	projectType: Project["type"]
): UpdateProjectPublicInfoRequest {
	const canEditStatus = projectType !== "STAGE";

	return {
		description: setting.isDescriptionEditable ? values.description : undefined,
		iconFileId: setting.isIconEditable ? values.iconFileId : undefined,
		mapImageFileIds: setting.isMapImagesEditable
			? values.mapImageFileIds
			: undefined,
		openStatus:
			canEditStatus && setting.isOpenStatusEditable
				? values.openStatus
				: undefined,
		stockStatus:
			canEditStatus && setting.isStockStatusEditable
				? values.stockStatus
				: undefined,
	};
}

/** 実委人により編集が制限されている項目に表示する注記 */
function RestrictedNotice() {
	return (
		<Flex align="center" gap="1" className={styles.restrictedNotice}>
			<IconLock size={14} />
			<Text size="1">実行委員会により、現在この項目は編集できません</Text>
		</Flex>
	);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: 1画面に複数の編集セクションを持つページのため
function ProjectPublicInfoPage() {
	const router = useRouter();
	const { user } = useAuthStore();
	const { projects, selectedProjectId } = useProjectStore();
	const setProjectIconFileId = useProjectStore(state => state.setIconFileId);
	const project = projects.find(p => p.id === selectedProjectId);

	const { publicInfo, publicInfoLoadFailed } = projectRoute.useLoaderData();
	const { setting } = Route.useLoaderData();

	const isEditable =
		project?.ownerId === user?.id || project?.subOwnerId === user?.id;

	// サーバー上の値。編集中（draft !== null）でなければ、そのまま画面に反映する
	const serverValues = useMemo(() => toFormValues(publicInfo), [publicInfo]);
	const serverValuesRef = useRef(serverValues);
	serverValuesRef.current = serverValues;

	const [draft, setDraft] = useState<FormValues | null>(null);
	const values = draft ?? serverValues;
	const isDirty = draft !== null && !isSameValues(draft, serverValues);

	const [isSaving, setIsSaving] = useState(false);
	const [uploadingCount, setUploadingCount] = useState(0);
	const [isUploadingIcon, setIsUploadingIcon] = useState(false);
	const isUploading = uploadingCount > 0 || isUploadingIcon;

	const [cropImageSrc, setCropImageSrc] = useState("");
	const [isCropModalOpen, setIsCropModalOpen] = useState(false);
	const [isPreviewOpen, setIsPreviewOpen] = useState(false);
	const [previewIndex, setPreviewIndex] = useState(0);

	const iconInputRef = useRef<HTMLInputElement>(null);
	const mapImagesInputRef = useRef<HTMLInputElement>(null);

	// 企画を切り替えたら編集内容を破棄する（前の企画の内容が残らないように）
	const [draftProjectId, setDraftProjectId] = useState(selectedProjectId);
	if (draftProjectId !== selectedProjectId) {
		setDraftProjectId(selectedProjectId);
		setDraft(null);
	}

	const updateValues = useCallback(
		(patch: Partial<FormValues> | ((current: FormValues) => FormValues)) => {
			setDraft(prev => {
				const base = prev ?? serverValuesRef.current;
				return typeof patch === "function"
					? patch(base)
					: { ...base, ...patch };
			});
		},
		[]
	);

	const blocker = useBlocker({
		shouldBlockFn: () => isDirty,
		enableBeforeUnload: () => isDirty,
		withResolver: true,
	});

	const handleSave = async () => {
		if (!project?.id || !isEditable) return;

		setIsSaving(true);
		try {
			await updateProjectPublicInfo(
				project.id,
				buildUpdateRequest(values, setting, project.type)
			);
		} catch (error) {
			reportHandledError({
				error,
				operation: "update_project_public_info",
				userMessage: "保存に失敗しました。",
				ui: { type: "toast" },
				context: { projectId: project.id },
			});
			return;
		} finally {
			setIsSaving(false);
		}

		toast.success("企画情報を保存しました。");
		// サイドバーのアイコンにも即時反映
		if (setting.isIconEditable) {
			setProjectIconFileId(project.id, values.iconFileId);
		}
		// 保存は成功しているため、再取得の成否にかかわらず編集状態は解除する
		await router.invalidate().catch(() => undefined);
		setDraft(null);
	};

	const handleCancel = () => {
		setDraft(null);
	};

	const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
		reader.onload = () => {
			setCropImageSrc(reader.result?.toString() ?? "");
			setIsCropModalOpen(true);
		};
		reader.readAsDataURL(file);
	};

	const handleCropComplete = async (blob: Blob) => {
		setIsUploadingIcon(true);
		try {
			const res = await uploadFile(
				new File([blob], "icon.png", { type: "image/png" }),
				{ isPublic: true }
			);
			updateValues({ iconFileId: res.file.id });
		} catch (error) {
			reportHandledError({
				error,
				operation: "update_project_public_info",
				userMessage: "アイコンのアップロードに失敗しました。",
				ui: { type: "toast" },
				context: { projectId: project?.id ?? null },
			});
		} finally {
			setIsUploadingIcon(false);
		}
	};

	const handleMapImagesUpload = async (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const files = Array.from(e.target.files ?? []);
		e.target.value = "";
		if (!files.length) return;

		const invalidFile = files.find(file => !isAllowedImageFile(file));
		if (invalidFile) {
			toast.error(
				`画像ファイルのみアップロードできます（${allowedImageExtensions}）。`
			);
			return;
		}

		if (values.mapImageFileIds.length + files.length > MAX_MAP_IMAGES) {
			toast.error(`Map掲載画像は最大${MAX_MAP_IMAGES}枚までです。`);
			return;
		}

		setUploadingCount(files.length);
		try {
			// 1枚失敗しても、成功した画像は取りこぼさない
			const results = await Promise.allSettled(
				files.map(file => uploadFile(file, { isPublic: true }))
			);
			const newIds = results
				.filter(r => r.status === "fulfilled")
				.map(r => r.value.file.id);

			if (newIds.length > 0) {
				updateValues(current => ({
					...current,
					mapImageFileIds: [
						...current.mapImageFileIds,
						// 同じ画像を続けてアップロードした場合の重複を防ぐ
						...newIds.filter(id => !current.mapImageFileIds.includes(id)),
					].slice(0, MAX_MAP_IMAGES),
				}));
				toast.success(
					`${newIds.length}枚の画像をアップロードしました。「保存する」を押すと反映されます。`
				);
			}

			const failed = results.find(r => r.status === "rejected");
			if (failed) {
				reportHandledError({
					error: failed.reason,
					operation: "update_project_public_info",
					userMessage: `${results.length - newIds.length}枚の画像のアップロードに失敗しました。`,
					ui: { type: "toast" },
					context: { projectId: project?.id ?? null },
				});
			}
		} finally {
			setUploadingCount(0);
		}
	};

	const removeMapImage = (index: number) => {
		updateValues(current => ({
			...current,
			mapImageFileIds: current.mapImageFileIds.filter((_, i) => i !== index),
		}));
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		updateValues(current => {
			const oldIndex = current.mapImageFileIds.indexOf(active.id as string);
			const newIndex = current.mapImageFileIds.indexOf(over.id as string);
			if (oldIndex < 0 || newIndex < 0) return current;

			return {
				...current,
				mapImageFileIds: arrayMove(current.mapImageFileIds, oldIndex, newIndex),
			};
		});
	};

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const canEditDescription = isEditable && setting.isDescriptionEditable;
	const canEditIcon = isEditable && setting.isIconEditable;
	const canEditMapImages = isEditable && setting.isMapImagesEditable;
	const canEditOpenStatus = isEditable && setting.isOpenStatusEditable;
	const canEditStockStatus = isEditable && setting.isStockStatusEditable;
	const canAddMore =
		canEditMapImages &&
		values.mapImageFileIds.length + uploadingCount < MAX_MAP_IMAGES;

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<Heading size="6">企画情報</Heading>
				<Text size="2" color="gray">
					設定した情報は「雙峰祭オンラインマップ」に公開されます。
				</Text>
			</div>

			{publicInfoLoadFailed && (
				<Callout.Root color="red" className={styles.callout}>
					<Callout.Icon>
						<IconInfoCircle size={16} />
					</Callout.Icon>
					<Callout.Text>
						企画情報の取得に失敗しました。ページを再読み込みしてください。
					</Callout.Text>
				</Callout.Root>
			)}

			{!isEditable && (
				<Callout.Root color="gray" className={styles.callout}>
					<Callout.Icon>
						<IconInfoCircle size={16} />
					</Callout.Icon>
					<Callout.Text>
						企画情報を編集できるのは企画責任者・副企画責任者のみです。閲覧のみ可能です。
					</Callout.Text>
				</Callout.Root>
			)}

			<Card className={styles.card}>
				<Flex direction="column" gap="4">
					<div>
						<Heading size="4">紹介文</Heading>
						<Text color="gray" size="2">
							オンラインマップに表示される企画の紹介文です。
						</Text>
					</div>
					{isEditable && !setting.isDescriptionEditable && <RestrictedNotice />}
					<Flex direction="column" gap="2">
						<TextArea
							label="紹介文（400文字以内）"
							value={values.description}
							onChange={description =>
								updateValues({
									description: description.slice(0, DESCRIPTION_MAX_LENGTH),
								})
							}
							disabled={!canEditDescription}
							placeholder="400文字以内で入力してください"
							rows={4}
						/>
						<Text size="1" color="gray" align="right">
							{values.description.length}/{DESCRIPTION_MAX_LENGTH}
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
					{isEditable && !setting.isIconEditable && <RestrictedNotice />}
					<input
						type="file"
						ref={iconInputRef}
						style={{ display: "none" }}
						accept={imageAcceptAttribute}
						onChange={handleIconSelect}
					/>
					<Flex gap="4" align="center">
						{/* クリックで変更できるアバター */}
						<div className={styles.iconWrapper}>
							<button
								type="button"
								className={styles.iconButton}
								onClick={() => iconInputRef.current?.click()}
								disabled={!canEditIcon || isUploadingIcon}
								aria-label="アイコン画像を変更"
							>
								<UserAvatar
									size={96}
									name={project?.name ?? ""}
									avatarFileId={values.iconFileId || null}
								/>
								{canEditIcon && (
									<span className={styles.iconOverlay}>
										<IconUpload size={20} color="white" />
										<span className={styles.iconOverlayLabel}>変更</span>
									</span>
								)}
							</button>
							{/* 削除バッジ */}
							{values.iconFileId && canEditIcon && (
								<button
									type="button"
									className={styles.iconDeleteBtn}
									onClick={() => updateValues({ iconFileId: "" })}
									aria-label="アイコンをデフォルトに戻す"
								>
									<IconX size={12} />
								</button>
							)}
						</div>
						<Flex direction="column" gap="1">
							<Text size="2" weight="medium">
								{values.iconFileId
									? "アイコンを変更する"
									: "アイコンを設定する"}
							</Text>
							<Text size="1" color="gray">
								{values.iconFileId
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
							オンラインマップに掲載される画像です（最大{MAX_MAP_IMAGES}
							枚）。ドラッグで並び替えできます。
						</Text>
					</div>
					{isEditable && !setting.isMapImagesEditable && <RestrictedNotice />}
					<input
						type="file"
						multiple
						ref={mapImagesInputRef}
						style={{ display: "none" }}
						accept={imageAcceptAttribute}
						onChange={handleMapImagesUpload}
					/>

					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
						modifiers={[restrictToParentElement]}
					>
						<SortableContext
							items={values.mapImageFileIds}
							strategy={rectSortingStrategy}
						>
							<div className={styles.mapImageGrid}>
								{values.mapImageFileIds.map((fileId, index) => (
									<SortableMapImageItem
										key={fileId}
										id={fileId}
										index={index}
										isEditable={canEditMapImages}
										onRemove={() => removeMapImage(index)}
										onPreview={() => {
											setPreviewIndex(index);
											setIsPreviewOpen(true);
										}}
									/>
								))}

								{/* アップロード中のスケルトン */}
								{Array.from({ length: uploadingCount }).map((_, i) => (
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
										disabled={uploadingCount > 0}
										aria-label="画像を追加"
									>
										<IconUpload size={20} />
										<span>追加</span>
										<span className={styles.mapImageAddHint}>
											{MAX_MAP_IMAGES - values.mapImageFileIds.length}
											枚まで追加可
										</span>
									</button>
								)}
							</div>
						</SortableContext>
					</DndContext>

					{/* 枚数インジケーター */}
					<Text size="1" color="gray">
						{values.mapImageFileIds.length} / {MAX_MAP_IMAGES} 枚
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
							{isEditable && !setting.isOpenStatusEditable && (
								<RestrictedNotice />
							)}
							<Select
								aria-label="開店状態"
								value={values.openStatus}
								onValueChange={value =>
									updateValues({ openStatus: value as OpenStatus })
								}
								disabled={!canEditOpenStatus}
								options={[
									{ value: "OPEN", label: "営業中" },
									{ value: "CLOSED", label: "準備中・閉店" },
									{ value: "NOT_APPLICABLE", label: "設定なし" },
								]}
							/>
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
							{isEditable && !setting.isStockStatusEditable && (
								<RestrictedNotice />
							)}
							<Select
								aria-label="在庫状態"
								value={values.stockStatus}
								onValueChange={value =>
									updateValues({ stockStatus: value as StockStatus })
								}
								disabled={!canEditStockStatus}
								options={[
									{ value: "IN_STOCK", label: "在庫あり" },
									{ value: "OUT_OF_STOCK", label: "在庫なし（完売）" },
									{ value: "NOT_APPLICABLE", label: "設定なし" },
								]}
							/>
						</Flex>
					</Card>
				</>
			)}

			{isEditable && (
				<div className={styles.actionBar}>
					<Text size="2" color="gray">
						{isUploading
							? "画像をアップロード中です…"
							: isDirty
								? "未保存の変更があります"
								: "変更はありません"}
					</Text>
					<Flex gap="3">
						<Button
							intent="secondary"
							onClick={handleCancel}
							disabled={!isDirty || isSaving || isUploading}
						>
							変更を破棄
						</Button>
						<Button
							onClick={handleSave}
							loading={isSaving}
							disabled={!isDirty || isSaving || isUploading}
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
				fileIds={values.mapImageFileIds}
				initialIndex={previewIndex}
				currentIndex={previewIndex}
				onChangeIndex={setPreviewIndex}
			/>

			<DiscardChangesDialog
				open={blocker.status === "blocked"}
				onOpenChange={open => {
					if (!open) blocker.reset?.();
				}}
				onConfirm={() => blocker.proceed?.()}
				title="保存していない変更があります"
				description="このページを離れると、保存していない変更は失われます。"
				cancelLabel="編集を続ける"
				confirmLabel="破棄して移動"
			/>
		</div>
	);
}
