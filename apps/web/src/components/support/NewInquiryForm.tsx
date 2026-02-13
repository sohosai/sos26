import { Dialog, Text } from "@radix-ui/themes";
import { IconCheck, IconFileText, IconX } from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useState } from "react";
import { Button, TextArea, TextField } from "@/components/primitives";
import type { Form, Person } from "@/mock/support";
import styles from "./NewInquiryForm.module.scss";

type NewInquiryFormProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	viewerRole: "project" | "committee";
	currentUser: Person;
	availableForms: Form[];
	committeeMembers: Person[];
	projectMembers: Person[];
	onSubmit: (params: {
		title: string;
		body: string;
		relatedForm: Form | null;
		projectAssignees: Person[];
		committeeAssignees: Person[];
	}) => void;
};

export function NewInquiryForm({
	open,
	onOpenChange,
	viewerRole,
	currentUser,
	availableForms,
	committeeMembers,
	projectMembers,
	onSubmit,
}: NewInquiryFormProps) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [selectedForm, setSelectedForm] = useState<Form | null>(null);
	const [selectedProjectAssignees, setSelectedProjectAssignees] = useState<
		Person[]
	>([]);
	const [selectedCommitteeAssignees, setSelectedCommitteeAssignees] = useState<
		Person[]
	>([]);

	const reset = () => {
		setTitle("");
		setBody("");
		setSelectedForm(null);
		setSelectedProjectAssignees([]);
		setSelectedCommitteeAssignees([]);
	};

	const handleSubmit = () => {
		if (!title.trim() || !body.trim()) return;

		const projectAssignees =
			viewerRole === "project" ? [currentUser] : selectedProjectAssignees;

		onSubmit({
			title: title.trim(),
			body: body.trim(),
			relatedForm: selectedForm,
			projectAssignees,
			committeeAssignees:
				viewerRole === "committee"
					? [currentUser, ...selectedCommitteeAssignees]
					: [],
		});
		reset();
		onOpenChange(false);
	};

	const toggleProjectAssignee = (person: Person) => {
		setSelectedProjectAssignees(prev =>
			prev.some(p => p.id === person.id)
				? prev.filter(p => p.id !== person.id)
				: [...prev, person]
		);
	};

	const toggleCommitteeAssignee = (person: Person) => {
		if (person.id === currentUser.id) return;
		setSelectedCommitteeAssignees(prev =>
			prev.some(p => p.id === person.id)
				? prev.filter(p => p.id !== person.id)
				: [...prev, person]
		);
	};

	return (
		<Dialog.Root
			open={open}
			onOpenChange={o => {
				if (!o) reset();
				onOpenChange(o);
			}}
		>
			<Dialog.Content maxWidth="640px">
				<Dialog.Title>新しい問い合わせを作成</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					{viewerRole === "project"
						? "実行委員会への問い合わせを作成します"
						: "企画への問い合わせを作成します"}
				</Dialog.Description>

				<div className={styles.form}>
					<TextField
						label="件名"
						placeholder="問い合わせの件名を入力"
						value={title}
						onChange={setTitle}
						required
					/>

					<TextArea
						label="内容"
						placeholder="問い合わせの内容を詳しく入力してください"
						value={body}
						onChange={setBody}
						rows={5}
						required
					/>

					{/* 関連フォーム選択 */}
					<div className={styles.formSection}>
						<div className={styles.formSectionHeader}>
							<IconFileText size={18} />
							<div>
								<Text size="2" weight="medium">
									関連するフォームを選択
								</Text>
								<Text size="1" color="gray">
									{viewerRole === "project"
										? "この問い合わせに関連するフォームがあれば選択してください"
										: "関連するフォームがあれば紐づけてください"}
								</Text>
							</div>
						</div>
						<div className={styles.formGrid}>
							{availableForms.map(form => {
								const isSelected = selectedForm?.id === form.id;
								return (
									<button
										key={form.id}
										type="button"
										className={`${styles.formCard} ${isSelected ? styles.formCardSelected : ""}`}
										onClick={() => setSelectedForm(isSelected ? null : form)}
									>
										<IconFileText size={16} />
										<Text size="2">{form.name}</Text>
										{isSelected && (
											<IconCheck size={16} className={styles.formCardCheck} />
										)}
									</button>
								);
							})}
						</div>
						{selectedForm && (
							<div className={styles.selectedFormBanner}>
								<IconCheck size={14} />
								<Text size="1">
									「{selectedForm.name}
									」に関連する問い合わせとして作成されます
								</Text>
								<button
									type="button"
									className={styles.clearForm}
									onClick={() => setSelectedForm(null)}
								>
									<IconX size={14} />
								</button>
							</div>
						)}
					</div>

					{/* 実委作成の場合: 企画側担当者を選択 */}
					{viewerRole === "committee" && (
						<div className={styles.assignSection}>
							<Text size="2" weight="medium">
								企画側の担当者を選択
							</Text>
							<Text size="1" color="gray">
								この問い合わせに対応する企画側のメンバーを選択してください
							</Text>
							<div className={styles.assignGrid}>
								{projectMembers.map(person => {
									const isSelected = selectedProjectAssignees.some(
										p => p.id === person.id
									);
									return (
										<button
											key={person.id}
											type="button"
											className={`${styles.assignCard} ${isSelected ? styles.assignCardSelected : ""}`}
											onClick={() => toggleProjectAssignee(person)}
										>
											<Avatar size={20} name={person.name} variant="beam" />
											<Text size="2">{person.name}</Text>
											{isSelected && <IconCheck size={14} />}
										</button>
									);
								})}
							</div>
						</div>
					)}

					{/* 実委作成の場合: 追加の実委担当者 */}
					{viewerRole === "committee" && (
						<div className={styles.assignSection}>
							<Text size="2" weight="medium">
								実行委員の追加担当者（任意）
							</Text>
							<Text size="1" color="gray">
								あなた（{currentUser.name}
								）は自動的に担当者になります
							</Text>
							<div className={styles.assignGrid}>
								{committeeMembers
									.filter(m => m.id !== currentUser.id)
									.map(person => {
										const isSelected = selectedCommitteeAssignees.some(
											p => p.id === person.id
										);
										return (
											<button
												key={person.id}
												type="button"
												className={`${styles.assignCard} ${isSelected ? styles.assignCardSelected : ""}`}
												onClick={() => toggleCommitteeAssignee(person)}
											>
												<Avatar size={20} name={person.name} variant="beam" />
												<Text size="2">{person.name}</Text>
												{isSelected && <IconCheck size={14} />}
											</button>
										);
									})}
							</div>
						</div>
					)}

					{viewerRole === "project" && (
						<div className={styles.infoBox}>
							<Text size="1" color="gray">
								あなた（{currentUser.name}
								）が企画側の担当者になります。実行委員側の担当者は実行委員会によって割り当てられます。
							</Text>
						</div>
					)}
				</div>

				<div className={styles.actions}>
					<Button intent="ghost" onClick={() => onOpenChange(false)}>
						キャンセル
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!title.trim() || !body.trim()}
					>
						問い合わせを作成
					</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
