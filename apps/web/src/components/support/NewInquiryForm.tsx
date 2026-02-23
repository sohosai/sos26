import {
	Badge,
	Dialog,
	Popover,
	TextField as RadixTextField,
	Text,
} from "@radix-ui/themes";
import type { Bureau, InquiryViewerScope } from "@sos26/shared";
import { bureauLabelMap } from "@sos26/shared";
import {
	IconCheck,
	IconChevronDown,
	IconPaperclip,
	IconPlus,
	IconSearch,
	IconX,
} from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, TextArea, TextField } from "@/components/primitives";
import { formatFileSize } from "@/lib/format";
import styles from "./NewInquiryForm.module.scss";

type ViewerInput = {
	scope: InquiryViewerScope;
	bureauValue?: Bureau;
	userId?: string;
};

const BUREAU_OPTIONS = Object.entries(bureauLabelMap).map(([value, label]) => ({
	value: value as Bureau,
	label,
}));

type UserSummary = { id: string; name: string };

type NewInquiryFormProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	viewerRole: "project" | "committee";
	currentUser: UserSummary;
	// Project side: project members for co-assignee selection
	projectMembers?: UserSummary[];
	// Committee only: projects to select from
	projects?: { id: string; name: string }[];
	// Committee only: load project members when a project is selected
	onLoadProjectMembers?: (
		projectId: string
	) => Promise<{ id: string; name: string }[]>;
	// Committee only: committee members for additional assignee selection
	committeeMembers?: UserSummary[];
	onSubmit: (params: {
		title: string;
		body: string;
		// Project side: co-assignees
		coAssigneeUserIds?: string[];
		// Committee only
		projectId?: string;
		projectAssigneeUserIds?: string[];
		committeeAssigneeUserIds?: string[];
		fileIds?: string[];
		viewers?: ViewerInput[];
	}) => Promise<void>;
};

export function NewInquiryForm({
	open,
	onOpenChange,
	viewerRole,
	currentUser,
	projectMembers,
	projects,
	onLoadProjectMembers,
	committeeMembers,
	onSubmit,
}: NewInquiryFormProps) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	// Committee side: project selection
	const [selectedProject, setSelectedProject] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [loadedProjectMembers, setLoadedProjectMembers] = useState<
		UserSummary[]
	>([]);
	const [selectedProjectAssignees, setSelectedProjectAssignees] = useState<
		UserSummary[]
	>([]);
	const [projectSearchQuery, setProjectSearchQuery] = useState("");
	const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
	const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
	const [projectSelectorQuery, setProjectSelectorQuery] = useState("");
	const [loadingMembers, setLoadingMembers] = useState(false);
	// Project side: co-assignee selection
	const [selectedCoAssignees, setSelectedCoAssignees] = useState<UserSummary[]>(
		[]
	);
	const [coAssigneePopoverOpen, setCoAssigneePopoverOpen] = useState(false);
	const [coAssigneeSearchQuery, setCoAssigneeSearchQuery] = useState("");
	// Committee side: additional committee assignee selection
	const [selectedCommitteeAssignees, setSelectedCommitteeAssignees] = useState<
		UserSummary[]
	>([]);
	const [committeePopoverOpen, setCommitteePopoverOpen] = useState(false);
	const [committeeSearchQuery, setCommitteeSearchQuery] = useState("");
	// 閲覧者設定（committee only）
	const [selectedViewers, setSelectedViewers] = useState<ViewerInput[]>([]);
	const [viewerAddMode, setViewerAddMode] = useState<
		"idle" | "BUREAU" | "INDIVIDUAL"
	>("idle");
	const [viewerMemberSearchQuery, setViewerMemberSearchQuery] = useState("");
	// ファイル添付
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
	// 送信状態
	const [isSubmitting, setIsSubmitting] = useState(false);

	const reset = () => {
		setTitle("");
		setBody("");
		setSelectedProject(null);
		setLoadedProjectMembers([]);
		setSelectedProjectAssignees([]);
		setProjectSearchQuery("");
		setProjectSelectorQuery("");
		setSelectedCoAssignees([]);
		setCoAssigneeSearchQuery("");
		setSelectedCommitteeAssignees([]);
		setCommitteeSearchQuery("");
		setSelectedViewers([]);
		setViewerAddMode("idle");
		setViewerMemberSearchQuery("");
		setSelectedFiles([]);
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
				setLoadedProjectMembers(members);
			} finally {
				setLoadingMembers(false);
			}
		}
	};

	const buildCommitteeParams = (fileIds?: string[]) => {
		if (!selectedProject || selectedProjectAssignees.length === 0) return null;
		return {
			title: title.trim(),
			body: body.trim(),
			projectId: selectedProject.id,
			projectAssigneeUserIds: selectedProjectAssignees.map(p => p.id),
			committeeAssigneeUserIds:
				selectedCommitteeAssignees.length > 0
					? selectedCommitteeAssignees.map(p => p.id)
					: undefined,
			fileIds,
			viewers: selectedViewers.length > 0 ? selectedViewers : undefined,
		};
	};

	const buildProjectParams = (fileIds?: string[]) => ({
		title: title.trim(),
		body: body.trim(),
		coAssigneeUserIds:
			selectedCoAssignees.length > 0
				? selectedCoAssignees.map(p => p.id)
				: undefined,
		fileIds,
	});

	const uploadFiles = async (files: File[]): Promise<string[]> => {
		const { uploadFile } = await import("@/lib/api/files");
		const results = await Promise.all(files.map(f => uploadFile(f)));
		return results.map(r => r.file.id);
	};

	const buildParams = (fileIds?: string[]) =>
		viewerRole === "committee"
			? buildCommitteeParams(fileIds)
			: buildProjectParams(fileIds);

	const handleSubmit = async () => {
		if (!canSubmit) return;

		setIsSubmitting(true);
		try {
			const fileIds =
				selectedFiles.length > 0 ? await uploadFiles(selectedFiles) : undefined;
			const params = buildParams(fileIds);
			if (!params) return;

			await onSubmit(params);
			reset();
			onOpenChange(false);
		} catch {
			toast.error("お問い合わせの作成に失敗しました");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { files } = e.target;
		if (files) {
			setSelectedFiles(prev => [...prev, ...Array.from(files)]);
		}
		e.target.value = "";
	};

	const removeFile = (index: number) => {
		setSelectedFiles(prev => prev.filter((_, i) => i !== index));
	};

	const toggleProjectAssignee = (person: UserSummary) => {
		setSelectedProjectAssignees(prev =>
			prev.some(p => p.id === person.id)
				? prev.filter(p => p.id !== person.id)
				: [...prev, person]
		);
	};

	const toggleCoAssignee = (person: UserSummary) => {
		setSelectedCoAssignees(prev =>
			prev.some(p => p.id === person.id)
				? prev.filter(p => p.id !== person.id)
				: [...prev, person]
		);
	};

	const toggleCommitteeAssignee = (person: UserSummary) => {
		setSelectedCommitteeAssignees(prev =>
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
						? "実行委員会へのお問い合わせを作成します"
						: "企画へのお問い合わせを作成します"}
				</Dialog.Description>

				<div className={styles.form}>
					<TextField
						label="件名"
						placeholder="お問い合わせの件名を入力"
						value={title}
						onChange={setTitle}
						required
					/>

					<TextArea
						label="内容"
						placeholder="お問い合わせの内容を詳しく入力してください"
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
								このお問い合わせの対象となる企画を選択してください
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
								このお問い合わせに対応する企画側のメンバーを選択してください
							</Text>
							{loadingMembers ? (
								<Text size="1" color="gray">
									メンバーを読み込み中...
								</Text>
							) : (
								<>
									<AssigneePopover
										open={projectPopoverOpen}
										onOpenChange={o => {
											setProjectPopoverOpen(o);
											if (!o) setProjectSearchQuery("");
										}}
										members={loadedProjectMembers}
										selected={selectedProjectAssignees}
										searchQuery={projectSearchQuery}
										onSearchChange={setProjectSearchQuery}
										onToggle={toggleProjectAssignee}
										triggerLabel="担当者を選択..."
									/>
									<SelectedChips
										items={selectedProjectAssignees}
										onRemove={toggleProjectAssignee}
									/>
								</>
							)}
						</div>
					)}

					{/* 実委作成の場合: 追加実委担当者（任意） */}
					{viewerRole === "committee" &&
						committeeMembers &&
						committeeMembers.length > 0 && (
							<div className={styles.assignSection}>
								<Text size="2" weight="medium">
									追加の実委担当者（任意）
								</Text>
								<Text size="1" color="gray">
									あなた以外に実委側の担当者を追加する場合に選択してください
								</Text>
								<AssigneePopover
									open={committeePopoverOpen}
									onOpenChange={o => {
										setCommitteePopoverOpen(o);
										if (!o) setCommitteeSearchQuery("");
									}}
									members={committeeMembers.filter(
										m => m.id !== currentUser.id
									)}
									selected={selectedCommitteeAssignees}
									searchQuery={committeeSearchQuery}
									onSearchChange={setCommitteeSearchQuery}
									onToggle={toggleCommitteeAssignee}
									triggerLabel="実委担当者を追加..."
								/>
								<SelectedChips
									items={selectedCommitteeAssignees}
									onRemove={toggleCommitteeAssignee}
								/>
							</div>
						)}

					{/* 実委作成の場合: 閲覧者設定（任意） */}
					{viewerRole === "committee" && committeeMembers && (
						<ViewerSelector
							selectedViewers={selectedViewers}
							onChangeViewers={setSelectedViewers}
							committeeMembers={committeeMembers}
							addMode={viewerAddMode}
							onAddModeChange={setViewerAddMode}
							memberSearchQuery={viewerMemberSearchQuery}
							onMemberSearchChange={setViewerMemberSearchQuery}
						/>
					)}

					{/* 企画作成の場合: 共同担当者（任意） */}
					{viewerRole === "project" &&
						projectMembers &&
						projectMembers.length > 1 && (
							<div className={styles.assignSection}>
								<Text size="2" weight="medium">
									共同担当者（任意）
								</Text>
								<Text size="1" color="gray">
									自企画のメンバーを共同担当者として追加できます
								</Text>
								<AssigneePopover
									open={coAssigneePopoverOpen}
									onOpenChange={o => {
										setCoAssigneePopoverOpen(o);
										if (!o) setCoAssigneeSearchQuery("");
									}}
									members={projectMembers.filter(m => m.id !== currentUser.id)}
									selected={selectedCoAssignees}
									searchQuery={coAssigneeSearchQuery}
									onSearchChange={setCoAssigneeSearchQuery}
									onToggle={toggleCoAssignee}
									triggerLabel="共同担当者を追加..."
								/>
								<SelectedChips
									items={selectedCoAssignees}
									onRemove={toggleCoAssignee}
								/>
							</div>
						)}

					{/* ファイル添付 */}
					<FileAttachmentArea
						fileInputRef={fileInputRef}
						selectedFiles={selectedFiles}
						onFileSelect={handleFileSelect}
						onRemoveFile={removeFile}
					/>

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
					<Button
						onClick={handleSubmit}
						disabled={!canSubmit || isSubmitting}
						loading={isSubmitting}
					>
						{isSubmitting ? "送信中..." : "お問い合わせを作成"}
					</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}

/* ─── 共通サブコンポーネント ─── */

function FileAttachmentArea({
	fileInputRef,
	selectedFiles,
	onFileSelect,
	onRemoveFile,
}: {
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	selectedFiles: File[];
	onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onRemoveFile: (index: number) => void;
}) {
	return (
		<div className={styles.fileSelectArea}>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				className={styles.fileInput}
				onChange={onFileSelect}
			/>
			<button
				type="button"
				className={styles.fileSelectButton}
				onClick={() => fileInputRef.current?.click()}
			>
				<IconPaperclip size={14} />
				<Text size="2">ファイルを添付</Text>
			</button>
			{selectedFiles.length > 0 && (
				<div className={styles.selectedFileList}>
					{selectedFiles.map((f, i) => (
						<div key={`${f.name}-${i}`} className={styles.selectedFileItem}>
							<IconPaperclip size={14} />
							<Text size="1">{f.name}</Text>
							<Text size="1" color="gray">
								({formatFileSize(f.size)})
							</Text>
							<button
								type="button"
								className={styles.selectedFileRemove}
								onClick={() => onRemoveFile(i)}
							>
								<IconX size={12} />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function AssigneePopover({
	open,
	onOpenChange,
	members,
	selected,
	searchQuery,
	onSearchChange,
	onToggle,
	triggerLabel,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	members: UserSummary[];
	selected: UserSummary[];
	searchQuery: string;
	onSearchChange: (q: string) => void;
	onToggle: (person: UserSummary) => void;
	triggerLabel: string;
}) {
	return (
		<Popover.Root open={open} onOpenChange={onOpenChange}>
			<Popover.Trigger>
				<button type="button" className={styles.assignTrigger}>
					<Text size="2" color="gray">
						{triggerLabel}
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
						value={searchQuery}
						onChange={e => onSearchChange(e.target.value)}
					>
						<RadixTextField.Slot>
							<IconSearch size={14} />
						</RadixTextField.Slot>
					</RadixTextField.Root>
				</div>
				<div className={styles.assignList}>
					{members
						.filter(person => {
							const q = searchQuery.toLowerCase();
							if (!q) return true;
							return person.name.toLowerCase().includes(q);
						})
						.map(person => {
							const isSelected = selected.some(p => p.id === person.id);
							return (
								<button
									key={person.id}
									type="button"
									className={`${styles.assignOption} ${isSelected ? styles.assignOptionSelected : ""}`}
									onClick={() => onToggle(person)}
								>
									<Avatar size={20} name={person.name} variant="beam" />
									<div className={styles.assignOptionText}>
										<Text size="2">{person.name}</Text>
									</div>
									{isSelected && (
										<IconCheck size={14} className={styles.assignOptionCheck} />
									)}
								</button>
							);
						})}
				</div>
			</Popover.Content>
		</Popover.Root>
	);
}

function SelectedChips({
	items,
	onRemove,
}: {
	items: UserSummary[];
	onRemove: (person: UserSummary) => void;
}) {
	if (items.length === 0) return null;

	return (
		<div className={styles.assignChips}>
			{items.map(person => (
				<span key={person.id} className={styles.assignChip}>
					<Avatar size={16} name={person.name} variant="beam" />
					<Text size="1">{person.name}</Text>
					<button
						type="button"
						className={styles.assignChipRemove}
						onClick={() => onRemove(person)}
					>
						<IconX size={12} />
					</button>
				</span>
			))}
		</div>
	);
}

function ViewerSelector({
	selectedViewers,
	onChangeViewers,
	committeeMembers,
	addMode,
	onAddModeChange,
	memberSearchQuery,
	onMemberSearchChange,
}: {
	selectedViewers: ViewerInput[];
	onChangeViewers: (viewers: ViewerInput[]) => void;
	committeeMembers: UserSummary[];
	addMode: "idle" | "BUREAU" | "INDIVIDUAL";
	onAddModeChange: (mode: "idle" | "BUREAU" | "INDIVIDUAL") => void;
	memberSearchQuery: string;
	onMemberSearchChange: (q: string) => void;
}) {
	const hasAllScope = selectedViewers.some(v => v.scope === "ALL");

	const handleSetAll = () => {
		onChangeViewers([{ scope: "ALL" }]);
	};

	const handleAddBureau = (bureau: Bureau) => {
		if (
			selectedViewers.some(
				v => v.scope === "BUREAU" && v.bureauValue === bureau
			)
		)
			return;
		onChangeViewers([
			...selectedViewers.filter(v => v.scope !== "ALL"),
			{ scope: "BUREAU", bureauValue: bureau },
		]);
		onAddModeChange("idle");
	};

	const handleAddIndividual = (userId: string) => {
		if (
			selectedViewers.some(v => v.scope === "INDIVIDUAL" && v.userId === userId)
		)
			return;
		onChangeViewers([
			...selectedViewers.filter(v => v.scope !== "ALL"),
			{ scope: "INDIVIDUAL", userId },
		]);
		onAddModeChange("idle");
		onMemberSearchChange("");
	};

	const handleRemoveViewer = (index: number) => {
		onChangeViewers(selectedViewers.filter((_, i) => i !== index));
	};

	const getViewerLabel = (viewer: ViewerInput): string => {
		if (viewer.scope === "ALL") return "全員";
		if (viewer.scope === "BUREAU" && viewer.bureauValue) {
			return bureauLabelMap[viewer.bureauValue] ?? viewer.bureauValue;
		}
		if (viewer.scope === "INDIVIDUAL" && viewer.userId) {
			const member = committeeMembers.find(m => m.id === viewer.userId);
			return member?.name ?? "不明";
		}
		return "不明";
	};

	const getScopeColor = (
		scope: InquiryViewerScope
	): "blue" | "orange" | "green" => {
		if (scope === "ALL") return "blue";
		if (scope === "BUREAU") return "orange";
		return "green";
	};

	return (
		<div className={styles.assignSection}>
			<Text size="2" weight="medium">
				閲覧者設定（任意）
			</Text>
			<Text size="1" color="gray">
				担当者以外に閲覧を許可する場合に設定してください
			</Text>

			{selectedViewers.length === 0 ? (
				<Text size="1" color="gray">
					閲覧者が設定されていません
				</Text>
			) : (
				<div className={styles.viewerList}>
					{selectedViewers.map((v, i) => (
						<div
							key={`${v.scope}-${v.bureauValue ?? v.userId ?? "all"}`}
							className={styles.viewerItem}
						>
							<Badge size="1" variant="soft" color={getScopeColor(v.scope)}>
								{getViewerLabel(v)}
							</Badge>
							<button
								type="button"
								className={styles.viewerItemRemove}
								onClick={() => handleRemoveViewer(i)}
							>
								<IconX size={12} />
							</button>
						</div>
					))}
				</div>
			)}

			{!hasAllScope && (
				<Popover.Root
					open={addMode !== "idle"}
					onOpenChange={o => {
						if (!o) {
							onAddModeChange("idle");
							onMemberSearchChange("");
						}
					}}
				>
					<div className={styles.viewerActions}>
						<button
							type="button"
							className={styles.viewerAddButton}
							onClick={handleSetAll}
						>
							全体公開にする
						</button>
						<Popover.Trigger>
							<button
								type="button"
								className={styles.viewerAddButton}
								onClick={() => onAddModeChange("BUREAU")}
							>
								<IconPlus size={12} />
								局を追加
							</button>
						</Popover.Trigger>
						<Popover.Trigger>
							<button
								type="button"
								className={styles.viewerAddButton}
								onClick={() => onAddModeChange("INDIVIDUAL")}
							>
								<IconPlus size={12} />
								個人を追加
							</button>
						</Popover.Trigger>
					</div>

					<Popover.Content
						className={styles.assignPopover}
						side="bottom"
						align="start"
					>
						{addMode === "BUREAU" && (
							<div className={styles.assignList}>
								{BUREAU_OPTIONS.map(opt => {
									const exists = selectedViewers.some(
										v => v.scope === "BUREAU" && v.bureauValue === opt.value
									);
									return (
										<button
											key={opt.value}
											type="button"
											className={`${styles.assignOption} ${exists ? styles.assignOptionSelected : ""}`}
											onClick={() => handleAddBureau(opt.value)}
											disabled={exists}
										>
											<Text size="2">{opt.label}</Text>
											{exists && (
												<IconCheck
													size={14}
													className={styles.assignOptionCheck}
												/>
											)}
										</button>
									);
								})}
							</div>
						)}
						{addMode === "INDIVIDUAL" && (
							<>
								<div className={styles.assignSearch}>
									<RadixTextField.Root
										placeholder="検索..."
										size="2"
										value={memberSearchQuery}
										onChange={e => onMemberSearchChange(e.target.value)}
									>
										<RadixTextField.Slot>
											<IconSearch size={14} />
										</RadixTextField.Slot>
									</RadixTextField.Root>
								</div>
								<div className={styles.assignList}>
									{committeeMembers
										.filter(m => {
											const q = memberSearchQuery.toLowerCase();
											if (!q) return true;
											return m.name.toLowerCase().includes(q);
										})
										.map(m => {
											const exists = selectedViewers.some(
												v => v.scope === "INDIVIDUAL" && v.userId === m.id
											);
											return (
												<button
													key={m.id}
													type="button"
													className={`${styles.assignOption} ${exists ? styles.assignOptionSelected : ""}`}
													onClick={() => handleAddIndividual(m.id)}
													disabled={exists}
												>
													<Avatar size={20} name={m.name} variant="beam" />
													<Text size="2">{m.name}</Text>
													{exists && (
														<IconCheck
															size={14}
															className={styles.assignOptionCheck}
														/>
													)}
												</button>
											);
										})}
								</div>
							</>
						)}
					</Popover.Content>
				</Popover.Root>
			)}

			{hasAllScope && (
				<Text size="1" color="blue">
					全ての実委人が閲覧可能です
				</Text>
			)}
		</div>
	);
}
