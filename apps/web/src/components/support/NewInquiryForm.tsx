import {
	Dialog,
	Popover,
	TextField as RadixTextField,
	Text,
} from "@radix-ui/themes";
import type { Bureau, InquiryViewerScope } from "@sos26/shared";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, TextArea, TextField } from "@/components/primitives";
import { FileAttachmentArea } from "./FileAttachmentArea";
import { FormViewerSelector } from "./FormViewerSelector";
import { MemberSelectPopover, SelectedChips } from "./MemberSelectPopover";
import styles from "./NewInquiryForm.module.scss";

type ViewerInput = {
	scope: InquiryViewerScope;
	bureauValue?: Bureau;
	userId?: string;
};

type UserSummary = { id: string; name: string };

type NewInquiryFormProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	viewerRole: "project" | "committee";
	currentUser: UserSummary;
	projectMembers?: UserSummary[];
	projects?: { id: string; name: string }[];
	onLoadProjectMembers?: (
		projectId: string
	) => Promise<{ id: string; name: string }[]>;
	committeeMembers?: UserSummary[];
	onSubmit: (params: {
		title: string;
		body: string;
		coAssigneeUserIds?: string[];
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
	const [selectedCoAssignees, setSelectedCoAssignees] = useState<UserSummary[]>(
		[]
	);
	const [coAssigneePopoverOpen, setCoAssigneePopoverOpen] = useState(false);
	const [coAssigneeSearchQuery, setCoAssigneeSearchQuery] = useState("");
	const [selectedCommitteeAssignees, setSelectedCommitteeAssignees] = useState<
		UserSummary[]
	>([]);
	const [committeePopoverOpen, setCommitteePopoverOpen] = useState(false);
	const [committeeSearchQuery, setCommitteeSearchQuery] = useState("");
	const [selectedViewers, setSelectedViewers] = useState<ViewerInput[]>([]);
	const [viewerAddMode, setViewerAddMode] = useState<
		"idle" | "BUREAU" | "INDIVIDUAL"
	>("idle");
	const [viewerMemberSearchQuery, setViewerMemberSearchQuery] = useState("");
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
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

	const uploadFiles = async (files: File[]): Promise<string[]> => {
		const { uploadFile } = await import("@/lib/api/files");
		const results = await Promise.all(files.map(f => uploadFile(f)));
		return results.map(r => r.file.id);
	};

	const buildParams = (fileIds?: string[]) => {
		if (viewerRole === "committee") {
			if (!selectedProject || selectedProjectAssignees.length === 0)
				return null;
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
		}
		return {
			title: title.trim(),
			body: body.trim(),
			coAssigneeUserIds:
				selectedCoAssignees.length > 0
					? selectedCoAssignees.map(p => p.id)
					: undefined,
			fileIds,
		};
	};

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
						<ProjectSelector
							projects={projects}
							selectedProject={selectedProject}
							open={projectSelectorOpen}
							onOpenChange={o => {
								setProjectSelectorOpen(o);
								if (!o) setProjectSelectorQuery("");
							}}
							searchQuery={projectSelectorQuery}
							onSearchChange={setProjectSelectorQuery}
							onSelect={handleSelectProject}
						/>
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
									<MemberSelectPopover
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
								<MemberSelectPopover
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
						<FormViewerSelector
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
								<MemberSelectPopover
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

/* ─── 企画選択 ─── */

function ProjectSelector({
	projects,
	selectedProject,
	open,
	onOpenChange,
	searchQuery,
	onSearchChange,
	onSelect,
}: {
	projects: { id: string; name: string }[];
	selectedProject: { id: string; name: string } | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	searchQuery: string;
	onSearchChange: (q: string) => void;
	onSelect: (project: { id: string; name: string }) => void;
}) {
	return (
		<div className={styles.assignSection}>
			<Text size="2" weight="medium">
				対象企画を選択
			</Text>
			<Text size="1" color="gray">
				このお問い合わせの対象となる企画を選択してください
			</Text>
			<Popover.Root open={open} onOpenChange={onOpenChange}>
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
							value={searchQuery}
							onChange={e => onSearchChange(e.target.value)}
						>
							<RadixTextField.Slot>
								<IconSearch size={14} />
							</RadixTextField.Slot>
						</RadixTextField.Root>
					</div>
					<div className={styles.assignList}>
						{projects
							.filter(p => {
								const q = searchQuery.toLowerCase();
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
										onClick={() => onSelect(project)}
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
	);
}
