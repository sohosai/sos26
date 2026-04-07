import { Dialog, SegmentedControl, Text } from "@radix-ui/themes";
import type { ProjectLocation, ProjectType } from "@sos26/shared";
import { IconListCheck, IconSend, IconX } from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useState } from "react";
import {
	Button,
	Checkbox,
	IconButton,
	Select,
	TextField,
} from "@/components/primitives";
import { ProjectCategorySelector } from "@/components/project/ProjectCategorySelector";
import { ProjectSelectDialog } from "@/components/project-select";
import { requestFormAuthorization } from "@/lib/api/committee-form";
import { reportHandledError } from "@/lib/error/report";
import { validateAuthorizationDates } from "@/lib/form/AuthDateCheck";
import { isClientError } from "@/lib/http/error";
import styles from "./FormPublishRequestDialog.module.scss";

type Approver = {
	userId: string;
	name: string;
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	formId: string;
	approvers: Approver[];
	onSuccess: () => void;
};

type DeliveryMode = "CATEGORY" | "INDIVIDUAL";

function getAuthorizationDateErrorMessage(params: {
	scheduledSendAt: Date;
	deadlineAt: Date | null;
}): string | null {
	const error = validateAuthorizationDates(params);

	switch (error) {
		case "PAST_SCHEDULED_SEND_AT":
			return "配信希望日時は未来の日時を指定してください。";
		case "INVALID_SCHEDULE_DEADLINE_ORDER":
			return "配信希望日時と回答期限の順番が不正です。";
		default:
			return null;
	}
}

export function FormPublishRequestDialog({
	open,
	onOpenChange,
	formId,
	approvers,
	onSuccess,
}: Props) {
	const [approverId, setApproverId] = useState("");

	// 配信日時
	const [sendDate, setSendDate] = useState("");
	const [sendTime, setSendTime] = useState("09:00");

	// 回答期限
	const [deadlineDate, setDeadlineDate] = useState("");
	const [deadlineTime, setDeadlineTime] = useState("23:59");

	// 遅延提出を認めるか
	const [allowLateResponse, setAllowLateResponse] = useState(false);

	// 申請の必須回答かどうか
	const [isRequired, setIsRequired] = useState(true);

	// 回答の閲覧制限（企画責任者・副企画責任者のみ）
	const [ownerOnly, setOwnerOnly] = useState(false);

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
		icon: <Avatar size={16} name={a.name} variant="beam" />,
	}));

	const canSubmit =
		approverId &&
		sendDate &&
		sendTime &&
		(deliveryMode === "CATEGORY" || selectedProjectIds.size > 0);

	const buildDeliveryTarget = () =>
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

	const handleSubmit = async () => {
		if (!canSubmit) return;
		setIsSubmitting(true);
		setError(null);
		try {
			const scheduledSendAt = new Date(`${sendDate}T${sendTime}+09:00`);
			const deadlineAt = deadlineDate
				? new Date(`${deadlineDate}T${deadlineTime}+09:00`)
				: null;

			const message = getAuthorizationDateErrorMessage({
				scheduledSendAt,
				deadlineAt,
			});

			if (message) {
				setError(message);
				setIsSubmitting(false);
				return;
			}

			await requestFormAuthorization(formId, {
				requestedToId: approverId,
				scheduledSendAt,
				deadlineAt,
				allowLateResponse,
				required: isRequired,
				ownerOnly,
				deliveryTarget: buildDeliveryTarget(),
			});
			onOpenChange(false);
			onSuccess();
		} catch (e) {
			reportHandledError({
				error: e,
				operation: "publish_request",
				userMessage: "公開申請の送信に失敗しました。",
				ui: { type: "inline", setError },
				resolveMessage: ({ error, fallbackMessage }) => {
					if (isClientError(error) && error.apiError) {
						return error.apiError.error.message;
					}

					return fallbackMessage;
				},
				context: {
					formId,
					approverId,
					deliveryMode,
				},
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleOpenChange = (o: boolean) => {
		onOpenChange(o);
		if (!o) {
			setApproverId("");
			setSendDate("");
			setSendTime("09:00");
			setDeadlineDate("");
			setDeadlineTime("23:59");
			setAllowLateResponse(false);
			setIsRequired(true);
			setOwnerOnly(false);
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
						配信日時・回答期限・配信先企画を指定し、承認を依頼します。
					</Dialog.Description>

					<div className={styles.form}>
						{/* 承認依頼先 */}
						<div className={styles.field}>
							<Text as="label" size="2" weight="medium">
								承認依頼先
							</Text>
							{approverOptions.length === 0 ? (
								<Text size="2" color="red">
									承認可能なメンバーがいません。FORM_DELIVER
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

						{/* 配信日時 */}
						<div className={styles.fieldGroup}>
							<Text as="label" size="2" weight="medium">
								配信日時
							</Text>
							<div className={styles.dateTimeRow}>
								<TextField
									label="配信日"
									type="date"
									value={sendDate}
									onChange={setSendDate}
								/>
								<TextField
									label="配信時刻"
									type="time"
									value={sendTime}
									onChange={setSendTime}
								/>
							</div>
						</div>

						{/* 回答期限（任意） */}
						<div className={styles.fieldGroup}>
							<Text as="label" size="2" weight="medium">
								回答期限
								<Text size="1" color="gray">
									（任意）
								</Text>
							</Text>
							<div className={styles.dateTimeRow}>
								<TextField
									label="期限日"
									type="date"
									value={deadlineDate}
									onChange={setDeadlineDate}
								/>
								<TextField
									label="期限時刻"
									type="time"
									value={deadlineTime}
									onChange={setDeadlineTime}
								/>
							</div>
						</div>

						{/* 遅延提出を認めるか */}
						<div className={styles.field}>
							<Checkbox
								label="期限後の遅延提出を認める"
								checked={allowLateResponse}
								onCheckedChange={checked =>
									setAllowLateResponse(checked === true)
								}
							/>
							<Text size="1" color="gray">
								チェックを入れると、期限を過ぎた後も申請への回答を受け付けます。
							</Text>
						</div>

						{/* 申請回答の必須設定 */}
						<div className={styles.field}>
							<Checkbox
								label="この申請への回答を必須にする"
								checked={isRequired}
								onCheckedChange={checked => setIsRequired(checked === true)}
							/>
							<Text size="1" color="gray">
								チェックを外すと、回答は任意になります。
							</Text>
						</div>

						{/* 回答の閲覧制限 */}
						<div className={styles.field}>
							<Checkbox
								label="回答の閲覧を企画責任者・副企画責任者に限定する"
								checked={ownerOnly}
								onCheckedChange={checked => setOwnerOnly(checked === true)}
							/>
							<Text size="1" color="gray">
								チェックを入れると、企画の一般メンバーは回答の閲覧・入力ができなくなります（申請の存在は表示されます）。
							</Text>
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
									配信先企画
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
				title="配信先企画を選択"
			/>
		</>
	);
}
