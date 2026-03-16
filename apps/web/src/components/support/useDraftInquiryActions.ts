import { useState } from "react";

export function useDraftInquiryActions(
	onPublishDraftInquiry?: () => Promise<void>,
	onDeleteDraftInquiry?: () => Promise<void>
) {
	const [isPublishingDraftInquiry, setIsPublishingDraftInquiry] =
		useState(false);
	const [isDeletingDraftInquiry, setIsDeletingDraftInquiry] = useState(false);
	const [deleteDraftConfirmOpen, setDeleteDraftConfirmOpen] = useState(false);

	const handlePublishDraftInquiry = async () => {
		if (!onPublishDraftInquiry || isPublishingDraftInquiry) return;
		setIsPublishingDraftInquiry(true);
		try {
			await onPublishDraftInquiry();
		} finally {
			setIsPublishingDraftInquiry(false);
		}
	};

	const handleDeleteDraftInquiry = async () => {
		if (!onDeleteDraftInquiry || isDeletingDraftInquiry) return;
		setIsDeletingDraftInquiry(true);
		try {
			await onDeleteDraftInquiry();
		} finally {
			setIsDeletingDraftInquiry(false);
		}
	};

	const handleConfirmDeleteDraftInquiry = async () => {
		try {
			await handleDeleteDraftInquiry();
			setDeleteDraftConfirmOpen(false);
		} catch {
			// keep dialog open on error
		}
	};

	const handleRequestDeleteDraftInquiry = () => {
		setDeleteDraftConfirmOpen(true);
	};

	return {
		isPublishingDraftInquiry,
		isDeletingDraftInquiry,
		deleteDraftConfirmOpen,
		setDeleteDraftConfirmOpen,
		handlePublishDraftInquiry,
		handleDeleteDraftInquiry,
		handleConfirmDeleteDraftInquiry,
		handleRequestDeleteDraftInquiry,
	};
}
