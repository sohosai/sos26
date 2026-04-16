import { Dialog, SegmentedControl, Text } from "@radix-ui/themes";
import type { ProjectLocation, ProjectType } from "@sos26/shared";
import { IconListCheck, IconSend, IconX } from "@tabler/icons-react";
import { useState } from "react";

import { UserAvatar } from "@/components/common/UserAvatar";
import { Button, IconButton, Select, TextField } from "@/components/primitives";
import { ProjectCategorySelector } from "@/components/project/ProjectCategorySelector";
import { ProjectSelectDialog } from "@/components/project-select";
import { createNoticeAuthorization } from "@/lib/api/committee-notice";
import { isClientError } from "@/lib/http/error";
import styles from "./PublishRequestDialog.module.scss";

type Approver = {
	userId: string;
	name: string;
	avatarFileId?: string | null;
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	noticeId: string;
	approvers: Approver[];
	onSuccess: () => void;
};

type DeliveryMode = "CATEGORY" | "INDIVIDUAL";

export function PublishRequestDialog({
	open,
	onOpenChange,
	noticeId,
	approvers,
	onSuccess,
}: Props) {
	const [approverId, setApproverId] = useState("");
	const [date, setDate] = useState("");
	const [time, setTime] = useState("09:00");

	// 配信先モード
	const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("CATEGORY");

	// 個別指定
	const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
		new Set()
	);

	// カテゴリ指定
	const [selectedTypes, setSelectedTypes] = useState<ProjectType[]>([]);
	const [selectedLocations, setSelectedLocations] = useState<ProjectLocation[]>(
		[]
	);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [projectSelectOpen, setProjectSelectOpen] = useState(false);

	const approverOptions = approvers.map(a => ({
		value: a.userId,
		label: a.name,
		icon: <UserAvatar size={16} name={a.name} avatarFileId={a.avatarFileId} />,
	}));

	const canSubmit =
		approverId &&
		date &&
		time &&
		(deliveryMode === "CATEGORY" || selectedProjectIds.size > 0);

	const handleSubmit = async () => {
		if (!canSubmit) return;
		setIsSubmitting(true);
		setError(null);
		try {
			const deliveredAt = new Date(`${date}T${time}+09:00`);

			const deliveryTarget =
				deliveryMode === "CATEGORY"
					? {
							mode: "CATEGORY" as const,
							projectTypes: selectedTypes,
							projectLocations: selectedLocations,
						}
					: {
							mode: "INDIVIDUAL" as const,
							projectIds: [...selectedProjectIds],
						};

			await createNoticeAuthorization(noticeId, {
				requestedToId: approverId,
				deliveredAt,
				deliveryTarget,
			});
			onOpenChange(false);
			onSuccess();
		} catch (e) {
			if (isClientError(e) && e.apiError) {
				setError(e.apiError.error.message);
			} else {
				setError("公開申請の送信に失敗しました。");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleOpenChange = (o: boolean) => {
		onOpenChange(o);
		if (!o) {
			setApproverId("");
			setDate("");
			setTime("09:00");
			setDeliveryMode("CATEGORY");
			setSelectedProjectIds(new Set());
			setSelectedTypes([]);
			setSelectedLocations([]);
			setError(null);
		}
	};

	const handleCategoryChange = (next: {
		types: ProjectType[];
		locations: ProjectLocation[];
	}) => {
		setSelectedTypes(next.types);
		setSelectedLocations(next.locations);
	};

	return (
		<>
			<Dialog.Root open={open} onOpenChange={handleOpenChange}>
				<Dialog.Content maxWidth="520px">
					<div className={styles.header}>
						<Dialog.Title mb="0">公開申請</Dialog.Title>
						<IconButton
							aria-label="閉じる"
							onClick={() => handleOpenChange(false)}
						>
							<IconX size={16} />
						</IconButton>
					</div>
					<Dialog.Description size="2" mb="4" color="gray">
						公開日時と公開先企画を指定し、承認を依頼します。
					</Dialog.Description>

					<div className={styles.form}>
						{/* 承認依頼先 */}
						<div className={styles.field}>
							<Text as="label" size="2" weight="medium">
								承認依頼先
							</Text>
							{approverOptions.length === 0 ? (
								<Text size="2" color="red">
									承認可能なメンバーがいません。NOTICE_DELIVER
									権限を持つメンバーを追加してください。
								</Text>
							) : (
								<Select
									options={approverOptions}
									value={approverId}
									onValueChange={setApproverId}
									placeholder="承認者を選択"
									size="2"
								/>
							)}
						</div>

						{/* 公開日時 */}
						<div className={styles.dateTimeRow}>
							<TextField
								label="公開日"
								type="date"
								value={date}
								onChange={setDate}
							/>
							<TextField
								label="公開時刻"
								type="time"
								value={time}
								onChange={setTime}
							/>
						</div>

						{/* 配信先指定モード */}
						<div className={styles.field}>
							<Text as="label" size="2" weight="medium">
								配信先の指定方法
							</Text>
							<SegmentedControl.Root
								value={deliveryMode}
								onValueChange={v => setDeliveryMode(v as DeliveryMode)}
								size="2"
							>
								<SegmentedControl.Item value="CATEGORY">
									カテゴリ指定
								</SegmentedControl.Item>
								<SegmentedControl.Item value="INDIVIDUAL">
									個別指定
								</SegmentedControl.Item>
							</SegmentedControl.Root>
						</div>

						{deliveryMode === "INDIVIDUAL" ? (
							/* 個別指定モード */
							<div className={styles.field}>
								<Text as="label" size="2" weight="medium">
									公開先企画
								</Text>
								<Button
									intent="secondary"
									size="2"
									onClick={() => setProjectSelectOpen(true)}
								>
									<IconListCheck size={16} />
									{selectedProjectIds.size > 0
										? `${selectedProjectIds.size}件の企画を選択中`
										: "配信先を選択"}
								</Button>
							</div>
						) : (
							/* カテゴリ指定モード */
							<>
								<ProjectCategorySelector
									selectedTypes={selectedTypes}
									selectedLocations={selectedLocations}
									onChange={handleCategoryChange}
									typeLabel="企画区分"
									locationLabel="実施場所"
									fieldClassName={styles.field}
									checkboxGroupClassName={styles.checkboxGroup}
								/>
								<Text size="1" color="gray">
									企画区分と実施場所の両方の条件を満たす企画に配信されます。片方のみ選択した場合はその条件のみで絞り込みます。両方未選択の場合は全企画に配信されます。
								</Text>
							</>
						)}

						{error && (
							<Text size="2" color="red">
								{error}
							</Text>
						)}
					</div>

					<div className={styles.actions}>
						<Button
							intent="secondary"
							size="2"
							onClick={() => handleOpenChange(false)}
							disabled={isSubmitting}
						>
							キャンセル
						</Button>
						<Button
							intent="primary"
							size="2"
							onClick={handleSubmit}
							loading={isSubmitting}
							disabled={!canSubmit}
						>
							<IconSend size={16} />
							公開申請を送信
						</Button>
					</div>
				</Dialog.Content>
			</Dialog.Root>

			<ProjectSelectDialog
				open={projectSelectOpen}
				onOpenChange={setProjectSelectOpen}
				selectedIds={selectedProjectIds}
				onConfirm={setSelectedProjectIds}
				title="公開先企画を選択"
			/>
		</>
	);
}
