import { Dialog, TextField as RadixTextField, Text } from "@radix-ui/themes";
import { IconSearch, IconSend, IconX } from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useEffect, useMemo, useState } from "react";
import {
	Button,
	Checkbox,
	IconButton,
	Select,
	TextField,
} from "@/components/primitives";
import { requestFormAuthorization } from "@/lib/api/committee-form";
import { listCommitteeProjects } from "@/lib/api/committee-project";
import { validateAuthorizationDates } from "@/lib/form/AuthDateCheck";
import { isClientError } from "@/lib/http/error";
import styles from "./FormPublishRequestDialog.module.scss";

type Approver = {
	userId: string;
	name: string;
};

type Project = {
	id: string;
	name: string;
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	formId: string;
	approvers: Approver[];
	onSuccess: () => void;
};

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

	// フォーム必須回答かどうか
	const [isRequired, setIsRequired] = useState(true);

	const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
		new Set()
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [projects, setProjects] = useState<Project[]>([]);
	const [isLoadingProjects, setIsLoadingProjects] = useState(false);
	const [projectSearch, setProjectSearch] = useState("");
	const [error, setError] = useState<string | null>(null);

	const approverOptions = approvers.map(a => ({
		value: a.userId,
		label: a.name,
		icon: <Avatar size={16} name={a.name} variant="beam" />,
	}));

	const filteredProjects = useMemo(() => {
		if (!projectSearch) return projects;
		const q = projectSearch.toLowerCase();
		return projects.filter(p => p.name.toLowerCase().includes(q));
	}, [projects, projectSearch]);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setIsLoadingProjects(true);
		listCommitteeProjects()
			.then(res => {
				if (!cancelled)
					setProjects(res.projects.map(p => ({ id: p.id, name: p.name })));
			})
			.catch(() => {
				if (!cancelled) setError("企画一覧の取得に失敗しました。");
			})
			.finally(() => {
				if (!cancelled) setIsLoadingProjects(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open]);

	const toggleProject = (id: string) => {
		setSelectedProjectIds(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const allFilteredSelected =
		filteredProjects.length > 0 &&
		filteredProjects.every(p => selectedProjectIds.has(p.id));

	const toggleAll = () => {
		setSelectedProjectIds(prev => {
			const next = new Set(prev);
			if (allFilteredSelected) {
				for (const p of filteredProjects) next.delete(p.id);
			} else {
				for (const p of filteredProjects) next.add(p.id);
			}
			return next;
		});
	};

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
	const canSubmit =
		approverId && sendDate && sendTime && selectedProjectIds.size > 0;

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
				projectIds: [...selectedProjectIds],
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
			setSendDate("");
			setSendTime("09:00");
			setDeadlineDate("");
			setDeadlineTime("23:59");
			setAllowLateResponse(false);
			setSelectedProjectIds(new Set());
			setProjectSearch("");
			setError(null);
		}
	};

	return (
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
					配信日時・回答期限・配信先プロジェクトを指定し、承認を依頼します。
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
							チェックを入れると、期限を過ぎた後もフォームへの回答を受け付けます。
						</Text>
					</div>

					{/* フォーム回答の必須設定 */}
					<div className={styles.field}>
						<Checkbox
							label="このフォームへの回答を必須にする"
							checked={isRequired}
							onCheckedChange={checked => setIsRequired(checked === true)}
						/>
						<Text size="1" color="gray">
							チェックを外すと、回答は任意になります。
						</Text>
					</div>

					{/* 配信先プロジェクト */}
					<div className={styles.field}>
						<div className={styles.projectHeader}>
							<Text as="label" size="2" weight="medium">
								配信先プロジェクト
							</Text>
							{projects.length > 0 && (
								<button
									type="button"
									className={styles.selectAllButton}
									onClick={toggleAll}
								>
									<Text size="1" color="blue">
										{allFilteredSelected ? "すべて解除" : "すべて選択"}
									</Text>
								</button>
							)}
						</div>
						{projects.length > 5 && (
							<RadixTextField.Root
								placeholder="企画名で検索..."
								aria-label="企画名で検索"
								size="1"
								value={projectSearch}
								onChange={e => setProjectSearch(e.target.value)}
							>
								<RadixTextField.Slot>
									<IconSearch size={14} />
								</RadixTextField.Slot>
							</RadixTextField.Root>
						)}
						<div className={styles.projectList}>
							{isLoadingProjects ? (
								<Text size="2" color="gray">
									読み込み中...
								</Text>
							) : filteredProjects.length === 0 ? (
								<Text size="2" color="gray">
									{projectSearch
										? "該当する企画がありません"
										: "企画がありません"}
								</Text>
							) : (
								filteredProjects.map(p => (
									<Checkbox
										key={p.id}
										label={p.name}
										checked={selectedProjectIds.has(p.id)}
										onCheckedChange={() => toggleProject(p.id)}
									/>
								))
							)}
						</div>
						{selectedProjectIds.size > 0 && (
							<Text size="1" color="gray">
								{selectedProjectIds.size}件選択中
							</Text>
						)}
					</div>

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
	);
}
