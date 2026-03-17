import { Text } from "@radix-ui/themes";
import { allowedMimeTypes } from "@sos26/shared";
import { IconPaperclip, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormEditDialog } from "@/components/form/Builder/EditDialog";
import type { Form } from "@/components/form/type";
import { Button, IconButton } from "@/components/primitives";
import { addFormAttachments, createForm } from "@/lib/api/committee-form";
import { uploadFile } from "@/lib/api/files";
import { formatFileSize } from "@/lib/format";
import styles from "./CreateFormDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
};

const EMPTY_FORM: Form = {
	id: "",
	name: "",
	description: undefined,
	attachments: [],
	items: [],
};

export function CreateFormDialog({ open, onOpenChange, onSuccess }: Props) {
	const [form, setForm] = useState<Form>(EMPTY_FORM);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [newFiles, setNewFiles] = useState<File[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// ダイアログを開いたタイミングで初期化
	useEffect(() => {
		if (open) {
			setForm(EMPTY_FORM);
			setNewFiles([]);
		}
	}, [open]);

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

	const handleSubmit = async (form: Form) => {
		setIsSubmitting(true);
		try {
			const response = await createForm({
				title: form.name,
				description: form.description,
				items: form.items.map((item, index) => ({
					label: item.label,
					type: item.type.toUpperCase() as Uppercase<typeof item.type>,
					description: item.description ?? null,
					required: item.required,
					sortOrder: index,
					options: item.options?.map((opt, i) => ({
						label: opt.label,
						sortOrder: i,
					})),
					constraints: item.constraints ?? null,
				})),
			});

			if (newFiles.length > 0) {
				const uploadResults = await Promise.all(
					newFiles.map(file => uploadFile(file))
				);
				await addFormAttachments(response.form.id, {
					fileIds: uploadResults.map(result => result.file.id),
				});
			}

			onSuccess?.();
			onOpenChange(false);
		} catch {
			toast.error("申請の作成に失敗しました");
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
