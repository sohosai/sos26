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
import { createNoticeAuthorization } from "@/lib/api/committee-notice";
import { listCommitteeProjects } from "@/lib/api/committee-project";
import styles from "./PublishRequestDialog.module.scss";

type Collaborator = {
	id: string;
	user: { id: string; name: string };
};

type Project = {
	id: string;
	name: string;
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	noticeId: string;
	collaborators: Collaborator[];
	onSuccess: () => void;
};

export function PublishRequestDialog({
	open,
	onOpenChange,
	noticeId,
	collaborators,
	onSuccess,
}: Props) {
	const [approverId, setApproverId] = useState("");
	const [date, setDate] = useState("");
	const [time, setTime] = useState("09:00");
	const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
		new Set()
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [projects, setProjects] = useState<Project[]>([]);
	const [isLoadingProjects, setIsLoadingProjects] = useState(false);
	const [projectSearch, setProjectSearch] = useState("");
	const [error, setError] = useState<string | null>(null);

	const approverOptions = collaborators.map(c => ({
		value: c.user.id,
		label: c.user.name,
		icon: <Avatar size={16} name={c.user.name} variant="beam" />,
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
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
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
				for (const p of filteredProjects) {
					next.delete(p.id);
				}
			} else {
				for (const p of filteredProjects) {
					next.add(p.id);
				}
			}
			return next;
		});
	};

	const canSubmit = approverId && date && time && selectedProjectIds.size > 0;

	const handleSubmit = async () => {
		if (!canSubmit) return;
		setIsSubmitting(true);
		setError(null);
		try {
			const deliveredAt = new Date(`${date}T${time}`);
			await createNoticeAuthorization(noticeId, {
				requestedToId: approverId,
				deliveredAt,
				projectIds: [...selectedProjectIds],
			});
			onOpenChange(false);
			onSuccess();
		} catch (e) {
			if (e instanceof Error) {
				setError(e.message);
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
					公開日時と公開先プロジェクトを指定し、承認を依頼します。
				</Dialog.Description>

				<div className={styles.form}>
					{/* 承認依頼先 */}
					<div className={styles.field}>
						<Text as="label" size="2" weight="medium">
							承認依頼先
						</Text>
						{approverOptions.length === 0 ? (
							<Text size="2" color="red">
								共同編集者がいません。先に共同編集者を追加してください。
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

					{/* 公開先プロジェクト */}
					<div className={styles.field}>
						<div className={styles.projectHeader}>
							<Text as="label" size="2" weight="medium">
								公開先プロジェクト
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
