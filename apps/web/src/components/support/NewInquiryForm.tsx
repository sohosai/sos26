import {
	Dialog,
	Popover,
	TextField as RadixTextField,
	Text,
} from "@radix-ui/themes";
import {
	IconCheck,
	IconChevronDown,
	IconSearch,
	IconX,
} from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useState } from "react";
import { Button, TextArea, TextField } from "@/components/primitives";
import styles from "./NewInquiryForm.module.scss";

type UserSummary = { id: string; name: string };

type NewInquiryFormProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	viewerRole: "project" | "committee";
	currentUser: UserSummary;
	// Committee only: projects to select from
	projects?: { id: string; name: string }[];
	// Committee only: load project members when a project is selected
	onLoadProjectMembers?: (
		projectId: string
	) => Promise<{ id: string; name: string }[]>;
	onSubmit: (params: {
		title: string;
		body: string;
		// Committee only
		projectId?: string;
		projectAssigneeUserIds?: string[];
	}) => Promise<void>;
};

export function NewInquiryForm({
	open,
	onOpenChange,
	viewerRole,
	currentUser,
	projects,
	onLoadProjectMembers,
	onSubmit,
}: NewInquiryFormProps) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [selectedProject, setSelectedProject] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [projectMembers, setProjectMembers] = useState<UserSummary[]>([]);
	const [selectedProjectAssignees, setSelectedProjectAssignees] = useState<
		UserSummary[]
	>([]);
	const [projectSearchQuery, setProjectSearchQuery] = useState("");
	const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
	const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
	const [projectSelectorQuery, setProjectSelectorQuery] = useState("");
	const [loadingMembers, setLoadingMembers] = useState(false);

	const reset = () => {
		setTitle("");
		setBody("");
		setSelectedProject(null);
		setProjectMembers([]);
		setSelectedProjectAssignees([]);
		setProjectSearchQuery("");
		setProjectSelectorQuery("");
	};

	const handleSelectProject = async (project: { id: string; name: string }) => {
		setSelectedProject(project);
		setSelectedProjectAssignees([]);
		setProjectSelectorOpen(false);
		setProjectSelectorQuery("");

		if (onLoadProjectMembers) {
			setLoadingMembers(true);
			try {
				const members = await onLoadProjectMembers(project.id);
				setProjectMembers(members);
			} finally {
				setLoadingMembers(false);
			}
		}
	};

	const handleSubmit = async () => {
		if (!title.trim() || !body.trim()) return;

		if (viewerRole === "committee") {
			if (!selectedProject || selectedProjectAssignees.length === 0) return;
			await onSubmit({
				title: title.trim(),
				body: body.trim(),
				projectId: selectedProject.id,
				projectAssigneeUserIds: selectedProjectAssignees.map(p => p.id),
			});
		} else {
			await onSubmit({
				title: title.trim(),
				body: body.trim(),
			});
		}

		reset();
		onOpenChange(false);
	};

	const toggleProjectAssignee = (person: UserSummary) => {
		setSelectedProjectAssignees(prev =>
			prev.some(p => p.id === person.id)
				? prev.filter(p => p.id !== person.id)
				: [...prev, person]
		);
	};

	const canSubmit =
		title.trim() &&
		body.trim() &&
		(viewerRole === "project" ||
			(selectedProject && selectedProjectAssignees.length > 0));

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

					{/* 実委作成の場合: 対象企画を選択 */}
					{viewerRole === "committee" && projects && (
						<div className={styles.assignSection}>
							<Text size="2" weight="medium">
								対象企画を選択
							</Text>
							<Text size="1" color="gray">
								この問い合わせの対象となる企画を選択してください
							</Text>
							<Popover.Root
								open={projectSelectorOpen}
								onOpenChange={o => {
									setProjectSelectorOpen(o);
									if (!o) setProjectSelectorQuery("");
								}}
							>
								<Popover.Trigger>
									<button type="button" className={styles.assignTrigger}>
										<Text size="2" color="gray">
											{selectedProject ? selectedProject.name : "企画を選択..."}
										</Text>
										<IconChevronDown size={16} />
									</button>
								</Popover.Trigger>
								<Popover.Content
									className={styles.assignPopover}
									side="bottom"
									align="start"
								>
									<div className={styles.assignSearch}>
										<RadixTextField.Root
											placeholder="企画名で検索..."
											size="2"
											value={projectSelectorQuery}
											onChange={e => setProjectSelectorQuery(e.target.value)}
										>
											<RadixTextField.Slot>
												<IconSearch size={14} />
											</RadixTextField.Slot>
										</RadixTextField.Root>
									</div>
									<div className={styles.assignList}>
										{projects
											.filter(p => {
												const q = projectSelectorQuery.toLowerCase();
												if (!q) return true;
												return p.name.toLowerCase().includes(q);
											})
											.map(project => {
												const isSelected = selectedProject?.id === project.id;
												return (
													<button
														key={project.id}
														type="button"
														className={`${styles.assignOption} ${isSelected ? styles.assignOptionSelected : ""}`}
														onClick={() => handleSelectProject(project)}
													>
														<div className={styles.assignOptionText}>
															<Text size="2">{project.name}</Text>
														</div>
														{isSelected && (
															<IconCheck
																size={14}
																className={styles.assignOptionCheck}
															/>
														)}
													</button>
												);
											})}
									</div>
								</Popover.Content>
							</Popover.Root>
						</div>
					)}

					{/* 実委作成の場合: 企画側担当者を選択 */}
					{viewerRole === "committee" && selectedProject && (
						<div className={styles.assignSection}>
							<Text size="2" weight="medium">
								企画側の担当者を選択
							</Text>
							<Text size="1" color="gray">
								この問い合わせに対応する企画側のメンバーを選択してください
							</Text>
							{loadingMembers ? (
								<Text size="1" color="gray">
									メンバーを読み込み中...
								</Text>
							) : (
								<>
									<Popover.Root
										open={projectPopoverOpen}
										onOpenChange={o => {
											setProjectPopoverOpen(o);
											if (!o) setProjectSearchQuery("");
										}}
									>
										<Popover.Trigger>
											<button type="button" className={styles.assignTrigger}>
												<Text size="2" color="gray">
													担当者を選択...
												</Text>
												<IconChevronDown size={16} />
											</button>
										</Popover.Trigger>
										<Popover.Content
											className={styles.assignPopover}
											side="bottom"
											align="start"
										>
											<div className={styles.assignSearch}>
												<RadixTextField.Root
													placeholder="検索..."
													size="2"
													value={projectSearchQuery}
													onChange={e => setProjectSearchQuery(e.target.value)}
												>
													<RadixTextField.Slot>
														<IconSearch size={14} />
													</RadixTextField.Slot>
												</RadixTextField.Root>
											</div>
											<div className={styles.assignList}>
												{projectMembers
													.filter(person => {
														const q = projectSearchQuery.toLowerCase();
														if (!q) return true;
														return person.name.toLowerCase().includes(q);
													})
													.map(person => {
														const isSelected = selectedProjectAssignees.some(
															p => p.id === person.id
														);
														return (
															<button
																key={person.id}
																type="button"
																className={`${styles.assignOption} ${isSelected ? styles.assignOptionSelected : ""}`}
																onClick={() => toggleProjectAssignee(person)}
															>
																<Avatar
																	size={20}
																	name={person.name}
																	variant="beam"
																/>
																<div className={styles.assignOptionText}>
																	<Text size="2">{person.name}</Text>
																</div>
																{isSelected && (
																	<IconCheck
																		size={14}
																		className={styles.assignOptionCheck}
																	/>
																)}
															</button>
														);
													})}
											</div>
										</Popover.Content>
									</Popover.Root>
									{selectedProjectAssignees.length > 0 && (
										<div className={styles.assignChips}>
											{selectedProjectAssignees.map(person => (
												<span key={person.id} className={styles.assignChip}>
													<Avatar size={16} name={person.name} variant="beam" />
													<Text size="1">{person.name}</Text>
													<button
														type="button"
														className={styles.assignChipRemove}
														onClick={() => toggleProjectAssignee(person)}
													>
														<IconX size={12} />
													</button>
												</span>
											))}
										</div>
									)}
								</>
							)}
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

					{viewerRole === "committee" && (
						<div className={styles.infoBox}>
							<Text size="1" color="gray">
								あなた（{currentUser.name}
								）が実行委員側の担当者になります。
							</Text>
						</div>
					)}
				</div>

				<div className={styles.actions}>
					<Button intent="ghost" onClick={() => onOpenChange(false)}>
						キャンセル
					</Button>
					<Button onClick={handleSubmit} disabled={!canSubmit}>
						問い合わせを作成
					</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
