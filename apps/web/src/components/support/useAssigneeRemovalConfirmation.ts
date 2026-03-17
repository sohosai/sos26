import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export function useAssigneeRemovalConfirmation(
	onRemoveAssignee: (assigneeId: string) => Promise<void>,
	basePath: string
) {
	const navigate = useNavigate();
	const [selfRemoveConfirmOpen, setSelfRemoveConfirmOpen] = useState(false);
	const [pendingRemoveAssigneeId, setPendingRemoveAssigneeId] = useState<
		string | null
	>(null);

	const handleRemoveAssignee = async (
		assigneeId: string,
		userId: string,
		currentUserId: string
	) => {
		if (userId === currentUserId) {
			setPendingRemoveAssigneeId(assigneeId);
			setSelfRemoveConfirmOpen(true);
			return;
		}
		try {
			await onRemoveAssignee(assigneeId);
		} catch {
			toast.error("委員の削除に失敗しました");
		}
	};

	const handleConfirmSelfRemove = async () => {
		if (!pendingRemoveAssigneeId) return;
		try {
			await onRemoveAssignee(pendingRemoveAssigneeId);
			setSelfRemoveConfirmOpen(false);
			setPendingRemoveAssigneeId(null);
			navigate({ to: basePath as string });
		} catch {
			toast.error("委員の削除に失敗しました");
		}
	};

	return {
		selfRemoveConfirmOpen,
		setSelfRemoveConfirmOpen,
		pendingRemoveAssigneeId,
		handleRemoveAssignee,
		handleConfirmSelfRemove,
	};
}
