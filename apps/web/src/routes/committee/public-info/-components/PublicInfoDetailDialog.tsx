import { Badge, Dialog, Flex, Heading, Text } from "@radix-ui/themes";
import type {
	CommitteeProjectPublicInfo,
	CorrectableProjectPublicInfoField,
	CorrectCommitteePublicInfoRequest,
	ProjectPublicInfoField,
	ProjectSnsLinkKey,
} from "@sos26/shared";
import {
	PROJECT_DESCRIPTION_MAX_LENGTH,
	PROJECT_SNS_LINKS_MAX_COUNT,
	projectSnsLinkInputSchemas,
} from "@sos26/shared";
import { useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button, TextArea, TextField } from "@/components/primitives";
import {
	correctCommitteePublicInfo,
	hideCommitteePublicInfoField,
	revertCommitteePublicInfoCorrection,
	unhideCommitteePublicInfoField,
	updateCommitteePublicInfoMapImage,
} from "@/lib/api/committee-public-info";
import { getFileContentUrl } from "@/lib/api/files";
import { reportHandledError } from "@/lib/error/report";
import { formatDate, formatProjectNumber } from "@/lib/format";
import styles from "./PublicInfoDetailDialog.module.scss";
import { FieldStatusBadges, findModeration, SNS_FIELDS } from "./shared";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: CommitteeProjectPublicInfo;
	onItemChange: (item: CommitteeProjectPublicInfo) => void;
};

/** 修正中の項目と入力値 */
type Editing =
	| { field: "DESCRIPTION"; value: string }
	| { field: ProjectPublicInfoField; key: ProjectSnsLinkKey; values: string[] };

function getSnsLinkError(key: ProjectSnsLinkKey, value: string) {
	if (value === "") return undefined;
	const result = projectSnsLinkInputSchemas[key].safeParse(value);
	return result.success ? undefined : result.error.issues[0]?.message;
}

/** 非表示・修正を操作した実委人と日時 */
function ModerationMeta({
	item,
	field,
}: {
	item: CommitteeProjectPublicInfo;
	field: ProjectPublicInfoField;
}) {
	const entries = (
		[
			["非表示", findModeration(item, field, "HIDDEN")],
			["修正", findModeration(item, field, "CORRECTED")],
		] as const
	).filter(([, m]) => m !== undefined);
	if (entries.length === 0) return null;
	return (
		<Flex direction="column">
			{entries.map(([label, m]) => (
				<Text key={label} size="1" color="gray">
					{label}: {m?.updatedBy.name}（
					{m && formatDate(m.updatedAt, "datetime")}）
				</Text>
			))}
		</Flex>
	);
}

export function PublicInfoDetailDialog({
	open,
	onOpenChange,
	item,
	onItemChange,
}: Props) {
	const [isBusy, setIsBusy] = useState(false);
	const [editing, setEditing] = useState<Editing | null>(null);
	const { publicInfo } = item;

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

	const toggleHidden = (field: ProjectPublicInfoField) => {
		const isHidden = !!findModeration(item, field, "HIDDEN");
		void run(
			() =>
				isHidden
					? unhideCommitteePublicInfoField(item.id, field)
					: hideCommitteePublicInfoField(item.id, field),
			isHidden ? "非表示を解除しました。" : "非表示にしました。"
		);
	};

	const toggleMapImage = (fileId: string) => {
		const isHidden = item.hiddenMapImageFileIds.includes(fileId);
		void run(
			() => updateCommitteePublicInfoMapImage(item.id, fileId, !isHidden),
			isHidden ? "画像の非表示を解除しました。" : "画像を非表示にしました。"
		);
	};

	const saveCorrection = async () => {
		if (!editing) return;
		const data: CorrectCommitteePublicInfoRequest =
			"key" in editing
				? { [editing.key]: editing.values.filter(v => v !== "") }
				: { description: editing.value };
		const ok = await run(
			() => correctCommitteePublicInfo(item.id, data),
			"修正しました。"
		);
		if (ok) setEditing(null);
	};

	const revertCorrection = (field: CorrectableProjectPublicInfoField) => {
		void run(
			() => revertCommitteePublicInfoCorrection(item.id, field),
			"修正前の値に戻しました。"
		);
	};

	/** 修正済みの項目に、修正前の企画の値と「元に戻す」を出す */
	const previousValue = (field: CorrectableProjectPublicInfoField) => {
		const correction = findModeration(item, field, "CORRECTED");
		if (!correction) return null;
		const value = correction.previousValue;
		const text = Array.isArray(value) ? value.join("\n") : value;
		return (
			<Flex
				justify="between"
				align="start"
				gap="2"
				className={styles.previousValue}
			>
				<Flex direction="column" gap="1">
					<Text size="1" color="gray">
						修正前
					</Text>
					<Text size="2" className={styles.value}>
						{text || "（未入力）"}
					</Text>
				</Flex>
				<Button
					intent="secondary"
					size="1"
					onClick={() => revertCorrection(field)}
					disabled={isBusy}
				>
					元に戻す
				</Button>
			</Flex>
		);
	};

	const hideButton = (field: ProjectPublicInfoField) => {
		const isHidden = !!findModeration(item, field, "HIDDEN");
		return (
			<Button
				intent={isHidden ? "secondary" : "danger"}
				size="1"
				onClick={() => toggleHidden(field)}
				disabled={isBusy}
			>
				{isHidden ? "非表示を解除" : "非表示にする"}
			</Button>
		);
	};

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

				{publicInfo === null ? (
					<Text size="2" color="gray">
						この企画はまだ企画情報を登録していません。
					</Text>
				) : (
					<Flex direction="column" gap="5">
						{/* 紹介文 */}
						<section className={styles.section}>
							<Flex justify="between" align="center" gap="2" wrap="wrap">
								<Flex align="center" gap="2">
									<Heading size="3">紹介文</Heading>
									<FieldStatusBadges item={item} field="DESCRIPTION" />
								</Flex>
								<Flex gap="2">
									{editing?.field !== "DESCRIPTION" && (
										<Button
											intent="secondary"
											size="1"
											onClick={() =>
												setEditing({
													field: "DESCRIPTION",
													value: publicInfo.description ?? "",
												})
											}
											disabled={isBusy}
										>
											修正する
										</Button>
									)}
									{hideButton("DESCRIPTION")}
								</Flex>
							</Flex>
							<ModerationMeta item={item} field="DESCRIPTION" />
							{previousValue("DESCRIPTION")}
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
									<Flex gap="2" justify="end">
										<Button
											intent="secondary"
											size="1"
											onClick={() => setEditing(null)}
											disabled={isBusy}
										>
											キャンセル
										</Button>
										<Button size="1" onClick={saveCorrection} loading={isBusy}>
											保存
										</Button>
									</Flex>
								</Flex>
							) : (
								<Text size="2" className={styles.value}>
									{publicInfo.description || "（未入力）"}
								</Text>
							)}
						</section>

						{/* アイコン */}
						<section className={styles.section}>
							<Flex justify="between" align="center" gap="2" wrap="wrap">
								<Flex align="center" gap="2">
									<Heading size="3">アイコン</Heading>
									<FieldStatusBadges item={item} field="ICON" />
								</Flex>
								{hideButton("ICON")}
							</Flex>
							<ModerationMeta item={item} field="ICON" />
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
						</section>

						{/* 掲載画像 */}
						<section className={styles.section}>
							<Heading size="3">掲載画像</Heading>
							{publicInfo.mapImageFileIds.length === 0 ? (
								<Text size="2" color="gray">
									（未設定）
								</Text>
							) : (
								<div className={styles.imageGrid}>
									{publicInfo.mapImageFileIds.map((fileId, index) => {
										const isHidden =
											item.hiddenMapImageFileIds.includes(fileId);
										return (
											<Flex key={fileId} direction="column" gap="1">
												<a
													href={getFileContentUrl(fileId)}
													target="_blank"
													rel="noreferrer"
													className={styles.imageLink}
												>
													<img
														src={getFileContentUrl(fileId)}
														alt={`掲載画像 ${index + 1}`}
														className={`${styles.image} ${isHidden ? styles.imageHidden : ""}`}
													/>
													{isHidden && (
														<Badge
															color="red"
															variant="solid"
															className={styles.imageBadge}
														>
															非表示
														</Badge>
													)}
												</a>
												<Button
													intent={isHidden ? "secondary" : "danger"}
													size="1"
													onClick={() => toggleMapImage(fileId)}
													disabled={isBusy}
												>
													{isHidden ? "解除" : "非表示"}
												</Button>
											</Flex>
										);
									})}
								</div>
							)}
						</section>

						{/* SNSリンク */}
						{SNS_FIELDS.map(({ key, field, label }) => {
							const isEditingThis =
								editing !== null && "key" in editing && editing.key === key;
							return (
								<section key={key} className={styles.section}>
									<Flex justify="between" align="center" gap="2" wrap="wrap">
										<Flex align="center" gap="2">
											<Heading size="3">{label}</Heading>
											<FieldStatusBadges item={item} field={field} />
										</Flex>
										<Flex gap="2">
											{!isEditingThis && (
												<Button
													intent="secondary"
													size="1"
													onClick={() =>
														setEditing({
															field,
															key,
															values: Array.from(
																{ length: PROJECT_SNS_LINKS_MAX_COUNT },
																(_, i) => publicInfo[key][i] ?? ""
															),
														})
													}
													disabled={isBusy}
												>
													修正する
												</Button>
											)}
											{hideButton(field)}
										</Flex>
									</Flex>
									<ModerationMeta item={item} field={field} />
									{previousValue(field)}
									{isEditingThis && "key" in editing ? (
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
													onClick={saveCorrection}
													loading={isBusy}
													disabled={editingSnsErrors.some(e => e !== undefined)}
												>
													保存
												</Button>
											</Flex>
										</Flex>
									) : publicInfo[key].length > 0 ? (
										<Flex direction="column">
											{publicInfo[key].map(value => (
												<Text key={value} size="2" className={styles.value}>
													{value}
												</Text>
											))}
										</Flex>
									) : (
										<Text size="2" color="gray">
											（未入力）
										</Text>
									)}
								</section>
							);
						})}
					</Flex>
				)}

				<Flex justify="end" mt="5">
					<Dialog.Close>
						<Button intent="secondary">閉じる</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
