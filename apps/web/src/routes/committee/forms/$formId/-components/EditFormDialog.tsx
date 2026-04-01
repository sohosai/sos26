import { Text } from "@radix-ui/themes";
import { allowedMimeTypes } from "@sos26/shared";
import { IconPaperclip, IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormEditDialog } from "@/components/form/Builder/EditDialog";
import type { Form } from "@/components/form/type";
import { Button, IconButton } from "@/components/primitives";
import {
	addFormAttachments,
	removeFormAttachment,
	updateFormDetail,
} from "@/lib/api/committee-form";
import { uploadFile } from "@/lib/api/files";
import { normalizeItemConstraintsForType } from "@/lib/form/constraints";
import { formatFileSize } from "@/lib/format";
import styles from "./EditFormDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	formId: string;
	initialValues: Form;
	onSuccess?: () => Promise<void>;
};

export function EditFormDialog({
	open,
	onOpenChange,
	formId,
	initialValues,
	onSuccess,
}: Props) {
	const [form, setForm] = useState<Form>(initialValues);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// 添付ファイル管理
	const [newFiles, setNewFiles] = useState<File[]>([]);
	const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>(
		[]
	);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const initialAttachments = initialValues.attachments ?? [];
	const existingAttachments = initialAttachments.filter(
		a => !removedAttachmentIds.includes(a.id)
	);

	// ダイアログを開いたタイミングで初期値にリセット
	useEffect(() => {
		if (open) {
			setForm(initialValues);
			setNewFiles([]);
			setRemovedAttachmentIds([]);
		}
	}, [open, initialValues]);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files) {
			setNewFiles(prev => [...prev, ...Array.from(files)]);
		}
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleRemoveNewFile = (index: number) => {
		setNewFiles(prev => prev.filter((_, i) => i !== index));
	};

	const handleMarkRemoveAttachment = (attachmentId: string) => {
		setRemovedAttachmentIds(prev => [...prev, attachmentId]);
	};

	const handleSubmit = async (submitted: Form) => {
		setIsSubmitting(true);
		try {
			const updatePromise = updateFormDetail(formId, {
				title: submitted.name,
				description: submitted.description,
				items: submitted.items.map((item, index) => ({
					id: item.id || undefined,
					label: item.label,
					description: item.description ?? null,
					type: item.type,
					required: item.required,
					sortOrder: index,
					options: item.options?.map((opt, i) => ({
						label: opt.label,
						sortOrder: i,
					})),
					constraints: normalizeItemConstraintsForType(
						item.type,
						item.constraints
					),
				})),
			});

			const uploadPromise =
				newFiles.length > 0
					? Promise.all(newFiles.map(file => uploadFile(file)))
					: null;

			const removePromise =
				removedAttachmentIds.length > 0
					? Promise.all(
							removedAttachmentIds.map(id => removeFormAttachment(formId, id))
						)
					: null;

			const [, uploadResults] = await Promise.all([
				updatePromise,
				uploadPromise,
				removePromise,
			]);

			if (uploadResults) {
				await addFormAttachments(formId, {
					fileIds: uploadResults.map(result => result.file.id),
				});
			}

			await onSuccess?.();
			onOpenChange(false);
		} catch {
			toast.error("申請の保存に失敗しました");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<FormEditDialog
			open={open}
			onOpenChange={onOpenChange}
			form={form}
			onSubmit={handleSubmit}
			loading={isSubmitting}
		>
			<div className={styles.attachmentSection}>
				<Text size="2" weight="medium">
					添付ファイル
				</Text>
				{existingAttachments.length > 0 && (
					<div className={styles.fileList}>
						{existingAttachments.map(att => (
							<div key={att.id} className={styles.fileItem}>
								<div className={styles.fileInfo}>
									<IconPaperclip size={14} />
									<Text size="2" truncate>
										{att.fileName}
									</Text>
									<Text size="1" color="gray">
										({formatFileSize(att.size)})
									</Text>
								</div>
								<IconButton
									aria-label="削除"
									size="1"
									onClick={() => handleMarkRemoveAttachment(att.id)}
								>
									<IconTrash size={14} />
								</IconButton>
							</div>
						))}
					</div>
				)}
				{newFiles.length > 0 && (
					<div className={styles.fileList}>
						{newFiles.map((file, index) => (
							<div key={`${file.name}-${index}`} className={styles.fileItem}>
								<div className={styles.fileInfo}>
									<IconPaperclip size={14} />
									<Text size="2" truncate>
										{file.name}
									</Text>
									<Text size="1" color="gray">
										({formatFileSize(file.size)})
									</Text>
								</div>
								<IconButton
									aria-label="取消"
									size="1"
									onClick={() => handleRemoveNewFile(index)}
								>
									<IconX size={14} />
								</IconButton>
							</div>
						))}
					</div>
				)}
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept={allowedMimeTypes.join(",")}
					onChange={handleFileSelect}
					className={styles.fileInput}
				/>
				<Button
					intent="secondary"
					type="button"
					onClick={() => fileInputRef.current?.click()}
				>
					ファイルを選択
				</Button>
			</div>
		</FormEditDialog>
	);
}
