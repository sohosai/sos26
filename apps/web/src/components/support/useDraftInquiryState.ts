import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/api/files";
import type { InquiryDetail } from "./types";

export function useDraftInquiryState(inquiry: InquiryDetail) {
	const [editingDraft, setEditingDraft] = useState(false);
	const [isSavingDraft, setIsSavingDraft] = useState(false);
	const [draftTitle, setDraftTitle] = useState(inquiry.title);
	const [draftBody, setDraftBody] = useState(inquiry.body);
	const [draftAttachments, setDraftAttachments] = useState(
		inquiry.attachments ?? []
	);
	const [draftFiles, setDraftFiles] = useState<File[]>([]);
	const draftFileInputRef = useRef<HTMLInputElement>(null);

	const resetDraftState = () => {
		setEditingDraft(false);
		setDraftTitle(inquiry.title);
		setDraftBody(inquiry.body);
		setDraftAttachments(inquiry.attachments ?? []);
		setDraftFiles([]);
	};

	const handleStartEditDraft = () => setEditingDraft(true);
	const handleCancelEditDraft = () => {
		resetDraftState();
	};

	const handleDraftFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { files } = e.target;
		if (files) {
			setDraftFiles(prev => [...prev, ...Array.from(files)]);
		}
		e.target.value = "";
	};

	const removeDraftFile = (index: number) => {
		setDraftFiles(prev => prev.filter((_, i) => i !== index));
	};

	const removeDraftAttachment = (attachmentId: string) => {
		setDraftAttachments(prev => prev.filter(att => att.id !== attachmentId));
	};

	const uploadDraftFiles = async (files: File[]): Promise<string[]> => {
		if (files.length === 0) return [];
		const results = await Promise.all(files.map(file => uploadFile(file)));
		return results.map(result => result.file.id);
	};

	const validateDraft = (title: string, body: string): boolean => {
		const trimmedTitle = title.trim();
		const trimmedBody = body.trim();
		if (!trimmedTitle || !trimmedBody) {
			toast.error("タイトルと本文の入力は必須です");
			return false;
		}
		return true;
	};

	return {
		editingDraft,
		setEditingDraft,
		isSavingDraft,
		setIsSavingDraft,
		draftTitle,
		setDraftTitle,
		draftBody,
		setDraftBody,
		draftAttachments,
		setDraftAttachments,
		draftFiles,
		setDraftFiles,
		draftFileInputRef,
		resetDraftState,
		handleStartEditDraft,
		handleCancelEditDraft,
		handleDraftFileSelect,
		removeDraftFile,
		removeDraftAttachment,
		uploadDraftFiles,
		validateDraft,
	};
}
