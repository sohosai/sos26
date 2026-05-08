import {
	Dialog,
	Popover,
	TextField as RadixTextField,
	Text,
} from "@radix-ui/themes";
import {
	type AllowedMimeType,
	allowedFileExtensions,
	allowedMimeTypes,
	type Bureau,
	type ViewerScope,
} from "@sos26/shared";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DiscardChangesDialog } from "@/components/patterns/DiscardChangesDialog";
import { Button, Select, TextArea, TextField } from "@/components/primitives";
import { formatProjectNumber } from "@/lib/format";
import {
	type ExistingAttachment,
	FileAttachmentArea,
} from "./FileAttachmentArea";
import { FormViewerSelector } from "./FormViewerSelector";
import { MemberSelectPopover, SelectedChips } from "./MemberSelectPopover";
import styles from "./NewInquiryForm.module.scss";

type ViewerInput = {
	scope: ViewerScope;
	bureauValue?: Bureau;
	userId?: string;
};

type UserSummary = { id: string; name: string; avatarFileId?: string | null };
type FormSummary = { id: string; title: string };
type SubmitParams = Parameters<NewInquiryFormProps["onSubmit"]>[0];

type InitialAttachment = ExistingAttachment & { fileId: string };

type NewInquiryFormProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode?: "create" | "edit";
	viewerRole: "project" | "committee";
	currentUser: UserSummary;
	projectMembers?: UserSummary[];
	projects?: { id: string; name: string; number: number }[];
	onLoadProjectMembers?: (projectId: string) => Promise<UserSummary[]>;
	committeeMembers?: UserSummary[];
	availableForms?: FormSummary[];
	onSubmit: (params: {
		title: string;
		body: string;
		relatedFormId?: string | null;
		coAssigneeUserIds?: string[];
		projectId?: string;
		projectAssigneeUserIds?: string[];
		committeeAssigneeUserIds?: string[];
		fileIds?: string[];
		viewers?: ViewerInput[];
		isDraft?: boolean;
	}) => Promise<void>;
	initialData?: {
		title: string;
		body: string;
		relatedFormId?: string | null;
		projectId?: string;
		existingAttachments?: InitialAttachment[];
		projectAssignees?: UserSummary[];
		committeeAssignees?: UserSummary[];
		coAssignees?: UserSummary[];
		viewers?: ViewerInput[];
	};
};

type BuildSubmitParamsInput = {
	viewerRole: NewInquiryFormProps["viewerRole"];
	title: string;
	body: string;
	selectedForm: FormSummary | null;
	selectedProject: { id: string; name: string; number: number } | null;
	selectedProjectAssignees: UserSummary[];
	selectedCommitteeAssignees: UserSummary[];
	selectedCoAssignees: UserSummary[];
	selectedViewers: ViewerInput[];
	fileIds?: string[];
};

const trimText = (value: string) => value.trim();

const buildCommitteeParams = ({
	title,
	body,
	selectedForm,
	selectedProject,
	selectedProjectAssignees,
	selectedCommitteeAssignees,
	selectedViewers,
	fileIds,
}: BuildSubmitParamsInput): SubmitParams | null => {
	if (!selectedProject || selectedProjectAssignees.length === 0) return null;
	return {
		title: trimText(title),
		body: trimText(body),
		relatedFormId: selectedForm?.id,
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

const buildProjectParams = ({
	title,
	body,
	selectedForm,
	selectedCoAssignees,
	fileIds,
}: BuildSubmitParamsInput): SubmitParams => ({
	title: trimText(title),
	body: trimText(body),
	relatedFormId: selectedForm?.id,
	coAssigneeUserIds:
		selectedCoAssignees.length > 0
			? selectedCoAssignees.map(p => p.id)
			: undefined,
	fileIds,
});

const buildSubmitParams = (
	input: BuildSubmitParamsInput
): SubmitParams | null => {
	if (input.viewerRole === "committee") return buildCommitteeParams(input);
	return buildProjectParams(input);
};

const getSuccessMessage = (mode: "create" | "edit", isDraft: boolean) => {
	if (mode === "edit") return "お問い合わせを更新しました";
	return isDraft ? "下書きとして保存しました" : "お問い合わせを作成しました";
};

const getErrorMessage = (mode: "create" | "edit", isDraft: boolean) => {
	if (mode === "edit") return "お問い合わせの更新に失敗しました";
	return isDraft
		? "下書きの保存に失敗しました"
		: "お問い合わせの作成に失敗しました";
};

const findFormById = (
	availableForms: FormSummary[] | undefined,
	id: string | null | undefined
): FormSummary | null => {
	if (!id || !availableForms) return null;
	return availableForms.find(f => f.id === id) ?? null;
};

const findProjectById = (
	projects: { id: string; name: string; number: number }[] | undefined,
	id: string | undefined
) => {
	if (!id || !projects) return null;
	return projects.find(p => p.id === id) ?? null;
};

const resolveInitialProject = (
	mode: "create" | "edit",
	projects: { id: string; name: string; number: number }[] | undefined,
	projectId: string | undefined
) => {
	const found = findProjectById(projects, projectId);
	if (found) return found;
	if (mode === "edit" && projectId) {
		return { id: projectId, name: "", number: 0 };
	}
	return null;
};

type FormState = {
	title: string;
	body: string;
	selectedForm: FormSummary | null;
	selectedProject: { id: string; name: string; number: number } | null;
	selectedProjectAssignees: UserSummary[];
	selectedCoAssignees: UserSummary[];
	selectedCommitteeAssignees: UserSummary[];
	selectedViewers: ViewerInput[];
	selectedFiles: File[];
	existingAttachments: InitialAttachment[];
};

const buildEditSubmitParams = (
	state: FormState,
	mergedFileIds: string[],
	isDraft: boolean
): SubmitParams => ({
	title: trimText(state.title),
	body: trimText(state.body),
	relatedFormId: state.selectedForm?.id ?? null,
	fileIds: mergedFileIds,
	projectAssigneeUserIds: state.selectedProjectAssignees.map(p => p.id),
	committeeAssigneeUserIds: state.selectedCommitteeAssignees.map(p => p.id),
	coAssigneeUserIds: state.selectedCoAssignees.map(p => p.id),
	viewers: state.selectedViewers,
	isDraft,
});

const sameIdSet = (a: { id: string }[], b: { id: string }[] = []) => {
	if (a.length !== b.length) return false;
	const bIds = new Set(b.map(x => x.id));
	return a.every(x => bIds.has(x.id));
};

const viewerKey = (v: ViewerInput) =>
	`${v.scope}:${v.bureauValue ?? ""}:${v.userId ?? ""}`;

const sameViewers = (a: ViewerInput[], b: ViewerInput[] = []) => {
	if (a.length !== b.length) return false;
	const bKeys = new Set(b.map(viewerKey));
	return a.every(v => bKeys.has(viewerKey(v)));
};

const isEditDirty = (
	state: FormState,
	initial: NewInquiryFormProps["initialData"]
) =>
	state.title !== (initial?.title ?? "") ||
	state.body !== (initial?.body ?? "") ||
	(state.selectedForm?.id ?? null) !== (initial?.relatedFormId ?? null) ||
	state.selectedFiles.length > 0 ||
	state.existingAttachments.length !==
		(initial?.existingAttachments?.length ?? 0) ||
	!sameIdSet(state.selectedProjectAssignees, initial?.projectAssignees) ||
	!sameIdSet(state.selectedCommitteeAssignees, initial?.committeeAssignees) ||
	!sameIdSet(state.selectedCoAssignees, initial?.coAssignees) ||
	!sameViewers(state.selectedViewers, initial?.viewers);

type SubmitOutcome =
	| { ok: true }
	| { ok: false; message?: string; silent?: boolean };

type RunSubmitDeps = {
	mode: "create" | "edit";
	viewerRole: NewInquiryFormProps["viewerRole"];
	onSubmit: NewInquiryFormProps["onSubmit"];
	uploadFiles: (files: File[]) => Promise<string[]>;
};

const runCreateSubmit = async (
	deps: RunSubmitDeps,
	state: FormState,
	mergedFileIds: string[],
	isDraft: boolean
): Promise<SubmitOutcome> => {
	const fileIds = mergedFileIds.length > 0 ? mergedFileIds : undefined;
	const params = buildSubmitParams({
		viewerRole: deps.viewerRole,
		title: state.title,
		body: state.body,
		selectedForm: state.selectedForm,
		selectedProject: state.selectedProject,
		selectedProjectAssignees: state.selectedProjectAssignees,
		selectedCommitteeAssignees: state.selectedCommitteeAssignees,
		selectedCoAssignees: state.selectedCoAssignees,
		selectedViewers: state.selectedViewers,
		fileIds,
	});
	if (!params) return { ok: false, silent: true };
	await deps.onSubmit({ ...params, isDraft });
	return { ok: true };
};

const runSubmit = async (
	deps: RunSubmitDeps,
	state: FormState,
	isDraft: boolean
): Promise<SubmitOutcome> => {
	try {
		const newFileIds =
			state.selectedFiles.length > 0
				? await deps.uploadFiles(state.selectedFiles)
				: [];
		const existingFileIds = state.existingAttachments.map(att => att.fileId);
		const mergedFileIds = [...existingFileIds, ...newFileIds];
		if (deps.mode === "edit") {
			await deps.onSubmit(buildEditSubmitParams(state, mergedFileIds, isDraft));
			return { ok: true };
		}
		return await runCreateSubmit(deps, state, mergedFileIds, isDraft);
	} catch {
		return { ok: false, message: getErrorMessage(deps.mode, isDraft) };
	}
};

const partitionFiles = (files: File[]) => {
	const valid: File[] = [];
	const invalid: File[] = [];
	for (const f of files) {
		if (allowedMimeTypes.includes(f.type as AllowedMimeType)) {
			valid.push(f);
		} else {
			invalid.push(f);
		}
	}
	return { valid, invalid };
};

const isCreateDirty = (state: FormState) =>
	state.title !== "" ||
	state.body !== "" ||
	state.selectedForm !== null ||
	state.selectedProject !== null ||
	state.selectedProjectAssignees.length > 0 ||
	state.selectedCoAssignees.length > 0 ||
	state.selectedCommitteeAssignees.length > 0 ||
	state.selectedViewers.length > 0 ||
	state.selectedFiles.length > 0;

function FormSection({
	availableForms,
	selectedForm,
	onSelect,
}: {
	availableForms?: FormSummary[];
	selectedForm: FormSummary | null;
	onSelect: (form: FormSummary | null) => void;
}) {
	if (!availableForms || availableForms.length === 0) return null;
	return (
		<FormSelector
			forms={availableForms}
			selectedForm={selectedForm}
			onSelect={onSelect}
		/>
	);
}

function CommitteeContent({
	projects,
	selectedProject,
	onSelectProject,
	loadingMembers,
	loadedProjectMembers,
	selectedProjectAssignees,
	onToggleProjectAssignee,
	committeeMembers,
	currentUser,
	selectedCommitteeAssignees,
	onToggleCommitteeAssignee,
	selectedViewers,
	onChangeViewers,
}: {
	projects?: { id: string; name: string; number: number }[];
	selectedProject: { id: string; name: string; number: number } | null;
	onSelectProject: (project: {
		id: string;
		name: string;
		number: number;
	}) => void;
	loadingMembers: boolean;
	loadedProjectMembers: UserSummary[];
	selectedProjectAssignees: UserSummary[];
	onToggleProjectAssignee: (person: UserSummary) => void;
	committeeMembers?: UserSummary[];
	currentUser: UserSummary;
	selectedCommitteeAssignees: UserSummary[];
	onToggleCommitteeAssignee: (person: UserSummary) => void;
	selectedViewers: ViewerInput[];
	onChangeViewers: (viewers: ViewerInput[]) => void;
}) {
	return (
		<>
			{projects && (
				<ProjectSelector
					projects={projects}
					selectedProject={selectedProject}
					onSelect={onSelectProject}
				/>
			)}

			{selectedProject && (
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
								members={loadedProjectMembers}
								selected={selectedProjectAssignees}
								onToggle={onToggleProjectAssignee}
								triggerLabel="担当者を選択..."
							/>
							<SelectedChips
								items={selectedProjectAssignees}
								onRemove={onToggleProjectAssignee}
							/>
						</>
					)}
				</div>
			)}

			{committeeMembers && committeeMembers.length > 0 && (
				<div className={styles.assignSection}>
					<Text size="2" weight="medium">
						追加の実委担当者（任意）
					</Text>
					<Text size="1" color="gray">
						あなた以外に実委側の担当者を追加する場合に選択してください
					</Text>
					<MemberSelectPopover
						members={committeeMembers.filter(m => m.id !== currentUser.id)}
						selected={selectedCommitteeAssignees}
						onToggle={onToggleCommitteeAssignee}
						triggerLabel="実委担当者を追加..."
					/>
					<SelectedChips
						items={selectedCommitteeAssignees}
						onRemove={onToggleCommitteeAssignee}
					/>
				</div>
			)}

			{committeeMembers && (
				<FormViewerSelector
					selectedViewers={selectedViewers}
					onChangeViewers={onChangeViewers}
					committeeMembers={committeeMembers}
				/>
			)}
		</>
	);
}

function ProjectContent({
	projectMembers,
	currentUser,
	selectedCoAssignees,
	onToggleCoAssignee,
}: {
	projectMembers?: UserSummary[];
	currentUser: UserSummary;
	selectedCoAssignees: UserSummary[];
	onToggleCoAssignee: (person: UserSummary) => void;
}) {
	if (!projectMembers || projectMembers.length <= 1) return null;
	return (
		<div className={styles.assignSection}>
			<Text size="2" weight="medium">
				共同担当者（任意）
			</Text>
			<Text size="1" color="gray">
				自企画のメンバーを共同担当者として追加できます
			</Text>
			<MemberSelectPopover
				members={projectMembers.filter(m => m.id !== currentUser.id)}
				selected={selectedCoAssignees}
				onToggle={onToggleCoAssignee}
				triggerLabel="共同担当者を追加..."
			/>
			<SelectedChips
				items={selectedCoAssignees}
				onRemove={onToggleCoAssignee}
			/>
		</div>
	);
}

function InfoBox({
	viewerRole,
	currentUser,
}: {
	viewerRole: NewInquiryFormProps["viewerRole"];
	currentUser: UserSummary;
}) {
	return (
		<div className={styles.infoBox}>
			<Text size="1" color="gray">
				{viewerRole === "project"
					? `あなた（${currentUser.name}）が企画側の担当者になります。実行委員側の担当者は実行委員会によって割り当てられます。`
					: `あなた（${currentUser.name}）が実行委員側の担当者になります。`}
			</Text>
		</div>
	);
}

function FormActions({
	mode,
	viewerRole,
	canSubmit,
	isSubmitting,
	onCancel,
	onSubmit,
}: {
	mode: "create" | "edit";
	viewerRole: NewInquiryFormProps["viewerRole"];
	canSubmit: boolean;
	isSubmitting: boolean;
	onCancel: () => void;
	onSubmit: (isDraft: boolean) => void;
}) {
	if (mode === "edit") {
		return (
			<div className={styles.actions}>
				<Button intent="ghost" onClick={onCancel}>
					キャンセル
				</Button>
				<Button
					onClick={() => onSubmit(false)}
					disabled={!canSubmit || isSubmitting}
					loading={isSubmitting}
				>
					{isSubmitting ? "保存中..." : "保存"}
				</Button>
			</div>
		);
	}

	return (
		<div className={styles.actions}>
			<Button intent="ghost" onClick={onCancel}>
				キャンセル
			</Button>
			{viewerRole === "committee" && (
				<Button
					intent="secondary"
					onClick={() => onSubmit(true)}
					disabled={!canSubmit || isSubmitting}
					loading={isSubmitting}
				>
					下書き保存
				</Button>
			)}
			<Button
				onClick={() => onSubmit(false)}
				disabled={!canSubmit || isSubmitting}
				loading={isSubmitting}
			>
				{isSubmitting ? "送信中..." : "お問い合わせを作成"}
			</Button>
		</div>
	);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: form component with many concerns (state init, reset, submit, dirty check, open/close, file upload) — splitting further would harm readability
export function NewInquiryForm({
	open,
	onOpenChange,
	mode = "create",
	viewerRole,
	currentUser,
	projectMembers,
	projects,
	onLoadProjectMembers,
	committeeMembers,
	availableForms,
	onSubmit,
	initialData,
}: NewInquiryFormProps) {
	const [title, setTitle] = useState(initialData?.title ?? "");
	const [body, setBody] = useState(initialData?.body ?? "");
	const [selectedForm, setSelectedForm] = useState<FormSummary | null>(
		findFormById(availableForms, initialData?.relatedFormId)
	);
	const [selectedProject, setSelectedProject] = useState<{
		id: string;
		name: string;
		number: number;
	} | null>(resolveInitialProject(mode, projects, initialData?.projectId));
	const [loadedProjectMembers, setLoadedProjectMembers] = useState<
		UserSummary[]
	>(mode === "edit" ? (projectMembers ?? []) : []);
	const [selectedProjectAssignees, setSelectedProjectAssignees] = useState<
		UserSummary[]
	>(initialData?.projectAssignees ?? []);
	const [loadingMembers, setLoadingMembers] = useState(false);
	const [selectedCoAssignees, setSelectedCoAssignees] = useState<UserSummary[]>(
		initialData?.coAssignees ?? []
	);
	const [selectedCommitteeAssignees, setSelectedCommitteeAssignees] = useState<
		UserSummary[]
	>(initialData?.committeeAssignees ?? []);
	const [selectedViewers, setSelectedViewers] = useState<ViewerInput[]>(
		initialData?.viewers ?? []
	);
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [existingAttachments, setExistingAttachments] = useState<
		InitialAttachment[]
	>(initialData?.existingAttachments ?? []);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [fileError, setFileError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [confirmClose, setConfirmClose] = useState(false);

	const formState: FormState = {
		title,
		body,
		selectedForm,
		selectedProject,
		selectedProjectAssignees,
		selectedCoAssignees,
		selectedCommitteeAssignees,
		selectedViewers,
		selectedFiles,
		existingAttachments,
	};

	const resetToInitial = () => {
		setTitle(initialData?.title ?? "");
		setBody(initialData?.body ?? "");
		setSelectedForm(findFormById(availableForms, initialData?.relatedFormId));
		setExistingAttachments(initialData?.existingAttachments ?? []);
		setSelectedFiles([]);
		setSelectedProjectAssignees(initialData?.projectAssignees ?? []);
		setSelectedCommitteeAssignees(initialData?.committeeAssignees ?? []);
		setSelectedCoAssignees(initialData?.coAssignees ?? []);
		setSelectedViewers(initialData?.viewers ?? []);
	};

	const resetToEmpty = () => {
		setTitle("");
		setBody("");
		setSelectedForm(null);
		setSelectedProject(null);
		setLoadedProjectMembers([]);
		setSelectedProjectAssignees([]);
		setSelectedCoAssignees([]);
		setSelectedCommitteeAssignees([]);
		setSelectedViewers([]);
		setSelectedFiles([]);
		setExistingAttachments([]);
	};

	const reset = () => {
		if (mode === "edit") resetToInitial();
		else resetToEmpty();
	};

	const removeExistingAttachment = (attachmentId: string) => {
		setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId));
	};

	const handleSelectProject = async (project: {
		id: string;
		name: string;
		number: number;
	}) => {
		setSelectedProject(project);
		setSelectedProjectAssignees([]);

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

	const submitInquiry = (isDraft: boolean) =>
		runSubmit({ mode, viewerRole, onSubmit, uploadFiles }, formState, isDraft);

	const handleSubmit = async (isDraft = false) => {
		if (!canSubmit) return;

		setIsSubmitting(true);
		const result = await submitInquiry(isDraft);
		setIsSubmitting(false);

		if (!result.ok) {
			if (!result.silent) {
				toast.error(result.message);
			}
			return;
		}

		reset();
		onOpenChange(false);
		toast.success(getSuccessMessage(mode, isDraft));
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { files } = e.target;
		e.target.value = "";
		if (!files) return;
		const { valid, invalid } = partitionFiles(Array.from(files));
		setFileError(
			invalid.length > 0
				? `対応していないファイル形式です（${allowedFileExtensions}）`
				: null
		);
		if (valid.length > 0) setSelectedFiles(prev => [...prev, ...valid]);
	};

	const removeFile = (index: number) => {
		setSelectedFiles(prev => prev.filter((_, i) => i !== index));
	};

	const toggleProjectAssignee = (person: UserSummary) => {
		setSelectedProjectAssignees(prev => toggleItem(prev, person));
	};

	const toggleCoAssignee = (person: UserSummary) => {
		setSelectedCoAssignees(prev => toggleItem(prev, person));
	};

	const toggleCommitteeAssignee = (person: UserSummary) => {
		setSelectedCommitteeAssignees(prev => toggleItem(prev, person));
	};

	const isDirty =
		mode === "edit"
			? isEditDirty(formState, initialData)
			: isCreateDirty(formState);

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			onOpenChange(true);
			return;
		}
		if (isDirty) {
			setConfirmClose(true);
			return;
		}
		reset();
		onOpenChange(false);
	};

	const handleDiscard = () => {
		setConfirmClose(false);
		reset();
		onOpenChange(false);
	};

	const canSubmit =
		trimText(title) &&
		trimText(body) &&
		(mode === "edit" ||
			viewerRole === "project" ||
			(selectedProject && selectedProjectAssignees.length > 0));

	const dialogTitle =
		mode === "edit" ? "お問い合わせを編集" : "新しいお問い合わせを作成";
	const dialogDescription =
		mode === "edit"
			? "下書きの内容を編集します"
			: viewerRole === "project"
				? "実行委員会へのお問い合わせを作成します"
				: "企画へのお問い合わせを作成します";

	return (
		<Dialog.Root open={open} onOpenChange={handleOpenChange}>
			<Dialog.Content maxWidth="640px">
				<Dialog.Title>{dialogTitle}</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					{dialogDescription}
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
						autoGrow
					/>

					<FormSection
						availableForms={availableForms}
						selectedForm={selectedForm}
						onSelect={setSelectedForm}
					/>

					{viewerRole === "committee" ? (
						<CommitteeContent
							projects={mode === "edit" ? undefined : projects}
							selectedProject={selectedProject}
							onSelectProject={handleSelectProject}
							loadingMembers={loadingMembers}
							loadedProjectMembers={loadedProjectMembers}
							selectedProjectAssignees={selectedProjectAssignees}
							onToggleProjectAssignee={toggleProjectAssignee}
							committeeMembers={committeeMembers}
							currentUser={currentUser}
							selectedCommitteeAssignees={selectedCommitteeAssignees}
							onToggleCommitteeAssignee={toggleCommitteeAssignee}
							selectedViewers={selectedViewers}
							onChangeViewers={setSelectedViewers}
						/>
					) : (
						<ProjectContent
							projectMembers={projectMembers}
							currentUser={currentUser}
							selectedCoAssignees={selectedCoAssignees}
							onToggleCoAssignee={toggleCoAssignee}
						/>
					)}

					<FileAttachmentArea
						fileInputRef={fileInputRef}
						selectedFiles={selectedFiles}
						onFileSelect={handleFileSelect}
						onRemoveFile={removeFile}
						existingAttachments={existingAttachments}
						onRemoveExistingAttachment={removeExistingAttachment}
						error={fileError}
					/>

					{mode === "create" && (
						<InfoBox viewerRole={viewerRole} currentUser={currentUser} />
					)}
				</div>

				<FormActions
					mode={mode}
					viewerRole={viewerRole}
					canSubmit={Boolean(canSubmit)}
					isSubmitting={isSubmitting}
					onCancel={() => onOpenChange(false)}
					onSubmit={handleSubmit}
				/>
			</Dialog.Content>
			<DiscardChangesDialog
				open={confirmClose}
				onOpenChange={setConfirmClose}
				onConfirm={handleDiscard}
			/>
		</Dialog.Root>
	);
}

/* ─── ユーティリティ ─── */

function toggleItem<T extends { id: string }>(prev: T[], item: T): T[] {
	return prev.some(p => p.id === item.id)
		? prev.filter(p => p.id !== item.id)
		: [...prev, item];
}

/* ─── 関連申請選択 ─── */

export function FormSelector({
	forms,
	selectedForm,
	onSelect,
}: {
	forms: FormSummary[];
	selectedForm: FormSummary | null;
	onSelect: (form: FormSummary | null) => void;
}) {
	const NONE = "__none__";
	const options = [
		{ value: NONE, label: "なし" },
		...forms.map(f => ({ value: f.id, label: f.title })),
	];

	const handleChange = (value: string) => {
		if (value === NONE) {
			onSelect(null);
		} else {
			onSelect(forms.find(f => f.id === value) ?? null);
		}
	};

	return (
		<div className={styles.assignSection}>
			<Text size="2" weight="medium">
				関連申請（任意）
			</Text>
			<Select
				options={options}
				value={selectedForm?.id ?? NONE}
				onValueChange={handleChange}
				placeholder="申請を選択..."
			/>
		</div>
	);
}

/* ─── 企画選択 ─── */

function ProjectSelector({
	projects,
	selectedProject,
	onSelect,
}: {
	projects: { id: string; name: string; number: number }[];
	selectedProject: { id: string; name: string; number: number } | null;
	onSelect: (project: { id: string; name: string; number: number }) => void;
}) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const filteredProjects = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		const sorted = [...projects].sort((a, b) => a.number - b.number);
		if (!query) return sorted;
		return sorted.filter(project => {
			const numberText = formatProjectNumber(project.number);
			const rawNumber = String(project.number);
			const nameMatch = project.name.toLowerCase().includes(query);
			const numberMatch =
				numberText.includes(query) || rawNumber.includes(query);
			return nameMatch || numberMatch;
		});
	}, [projects, searchQuery]);

	const handleSelect = (project: {
		id: string;
		name: string;
		number: number;
	}) => {
		onSelect(project);
		setOpen(false);
		setSearchQuery("");
	};

	return (
		<div className={styles.assignSection}>
			<Text size="2" weight="medium">
				対象企画を選択
			</Text>
			<Text size="1" color="gray">
				このお問い合わせの対象となる企画を選択してください
			</Text>
			<Popover.Root
				open={open}
				onOpenChange={o => {
					setOpen(o);
					if (!o) setSearchQuery("");
				}}
			>
				<Popover.Trigger>
					<button type="button" className={styles.assignTrigger}>
						<Text size="2" color="gray">
							{selectedProject
								? `${formatProjectNumber(selectedProject.number)} ${selectedProject.name}`
								: "企画を選択..."}
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
							placeholder="企画名・企画番号で検索..."
							size="2"
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
						>
							<RadixTextField.Slot>
								<IconSearch size={14} />
							</RadixTextField.Slot>
						</RadixTextField.Root>
					</div>
					<div className={styles.assignList}>
						{filteredProjects.map(project => {
							const isSelected = selectedProject?.id === project.id;
							return (
								<button
									key={project.id}
									type="button"
									className={`${styles.assignOption} ${
										isSelected ? styles.assignOptionSelected : ""
									}`}
									onClick={() => handleSelect(project)}
								>
									<div className={styles.assignOptionText}>
										<Text size="2">
											{formatProjectNumber(project.number)} {project.name}
										</Text>
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
		</div>
	);
}
