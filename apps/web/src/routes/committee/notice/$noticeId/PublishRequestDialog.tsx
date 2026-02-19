import { Dialog, Text } from "@radix-ui/themes";
import { IconSend, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button, Checkbox, IconButton, Select } from "@/components/primitives";
import styles from "./PublishRequestDialog.module.scss";

// TODO: 実際のAPIに差し替える
const mockApprovers = [
	{ value: "user-1", label: "山田 太郎（局長）" },
	{ value: "user-2", label: "佐藤 次郎（副局長）" },
	{ value: "user-3", label: "高橋 三郎（部長）" },
];

const mockProjects = [
	{ id: "proj-1", name: "模擬店A" },
	{ id: "proj-2", name: "ステージ企画B" },
	{ id: "proj-3", name: "展示企画C" },
	{ id: "proj-4", name: "飲食企画D" },
	{ id: "proj-5", name: "物販企画E" },
];

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function PublishRequestDialog({ open, onOpenChange }: Props) {
	const [approverId, setApproverId] = useState("");
	const [date, setDate] = useState("");
	const [time, setTime] = useState("09:00");
	const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
		new Set()
	);
	const [isSubmitting, setIsSubmitting] = useState(false);

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

	const canSubmit = approverId && date && time && selectedProjectIds.size > 0;

	const handleSubmit = async () => {
		if (!canSubmit) return;
		setIsSubmitting(true);
		try {
			// TODO: createNoticeAuthorization API を呼ぶ
			alert(
				JSON.stringify(
					{
						approverId,
						deliveredAt: `${date}T${time}`,
						projectIds: [...selectedProjectIds],
					},
					null,
					2
				)
			);
			onOpenChange(false);
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
						<Select
							options={mockApprovers}
							value={approverId}
							onValueChange={setApproverId}
							placeholder="承認者を選択"
							size="2"
						/>
					</div>

					{/* 公開日時 */}
					<div className={styles.field}>
						<Text as="label" size="2" weight="medium">
							公開日時
						</Text>
						<div className={styles.dateTimeRow}>
							<input
								type="date"
								className={styles.dateInput}
								value={date}
								onChange={e => setDate(e.target.value)}
							/>
							<input
								type="time"
								className={styles.timeInput}
								value={time}
								onChange={e => setTime(e.target.value)}
							/>
						</div>
						<Text size="1" color="gray">
							未来の日時のみ指定できます。
						</Text>
					</div>

					{/* 公開先プロジェクト */}
					<div className={styles.field}>
						<Text as="label" size="2" weight="medium">
							公開先プロジェクト
						</Text>
						<div className={styles.projectList}>
							{mockProjects.map(p => (
								<Checkbox
									key={p.id}
									label={p.name}
									checked={selectedProjectIds.has(p.id)}
									onCheckedChange={() => toggleProject(p.id)}
								/>
							))}
						</div>
					</div>
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
