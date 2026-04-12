import {
	Button,
	Dialog,
	Heading,
	Select,
	Spinner,
	TextField,
} from "@radix-ui/themes";
import type {
	CommitteeProjectDetail,
	UpdateCommitteeProjectBaseInfoRequest,
} from "@sos26/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	listCommitteeProjectMembers,
	updateCommitteeProjectBaseInfo,
} from "@/lib/api/committee-project";
import { reportHandledError } from "@/lib/error/report";
import styles from "../$projectId.module.scss";
import { Field } from "./Field";

type EditFormState = UpdateCommitteeProjectBaseInfoRequest & {
	ownerId?: string;
	subOwnerId?: string | null;
};

type EditProjectDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	project: CommitteeProjectDetail;
	onProjectUpdate: (
		updated: Omit<CommitteeProjectDetail, "actions" | "permissions">
	) => void;
};

export function EditProjectDialog({
	open,
	onOpenChange,
	project,
	onProjectUpdate,
}: EditProjectDialogProps) {
	const [loadingMembers, setLoadingMembers] = useState(false);
	const [saving, setSaving] = useState(false);
	const [projectMembers, setProjectMembers] = useState<
		Array<{ userId: string; name: string }>
	>([]);
	const [form, setForm] = useState<EditFormState>({
		name: project.name,
		namePhonetic: project.namePhonetic,
		organizationName: project.organizationName,
		organizationNamePhonetic: project.organizationNamePhonetic,
		type: project.type,
		location: project.location,
		ownerId: project.owner.id,
		subOwnerId: project.subOwner?.id ?? null,
	});

	useEffect(() => {
		if (!open) return;

		setForm({
			name: project.name,
			namePhonetic: project.namePhonetic,
			organizationName: project.organizationName,
			organizationNamePhonetic: project.organizationNamePhonetic,
			type: project.type,
			location: project.location,
			ownerId: project.owner.id,
			subOwnerId: project.subOwner?.id ?? null,
		});

		const loadMembers = async () => {
			try {
				setLoadingMembers(true);
				const res = await listCommitteeProjectMembers(project.id);
				setProjectMembers(
					res.members.map(m => ({
						userId: m.userId,
						name: m.name,
					}))
				);
			} catch (error) {
				reportHandledError({
					error,
					operation: "read",
					userMessage: "メンバーリストの読み込みに失敗しました",
					ui: { type: "toast" },
				});
				onOpenChange(false);
			} finally {
				setLoadingMembers(false);
			}
		};

		loadMembers();
	}, [open, project, onOpenChange]);

	const handleSave = async () => {
		try {
			setSaving(true);

			// 責任者情報を含めて基本情報を更新
			const res = await updateCommitteeProjectBaseInfo(project.id, form);
			onProjectUpdate(res.project);

			onOpenChange(false);
			toast.success("企画情報を更新しました");
		} catch (error) {
			reportHandledError({
				error,
				operation: "update_base_info",
				userMessage: "企画情報の更新に失敗しました",
				ui: { type: "toast" },
				context: { projectId: project.id },
			});
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content>
				<Dialog.Title>企画の基本情報を編集</Dialog.Title>
				{loadingMembers ? (
					<div className={styles.loading}>
						<Spinner size="3" />
					</div>
				) : (
					<>
						<div className={styles.form}>
							<Field label="企画名">
								<TextField.Root
									value={form.name ?? ""}
									onChange={e =>
										setForm(prev => ({ ...prev, name: e.target.value }))
									}
								/>
							</Field>
							<Field label="企画名（ふりがな）">
								<TextField.Root
									value={form.namePhonetic ?? ""}
									onChange={e =>
										setForm(prev => ({
											...prev,
											namePhonetic: e.target.value,
										}))
									}
								/>
							</Field>
							<Field label="企画団体名">
								<TextField.Root
									value={form.organizationName ?? ""}
									onChange={e =>
										setForm(prev => ({
											...prev,
											organizationName: e.target.value,
										}))
									}
								/>
							</Field>
							<Field label="企画団体名（ふりがな）">
								<TextField.Root
									value={form.organizationNamePhonetic ?? ""}
									onChange={e =>
										setForm(prev => ({
											...prev,
											organizationNamePhonetic: e.target.value,
										}))
									}
								/>
							</Field>

							{projectMembers.length > 0 && (
								<>
									<Heading size="3" style={{ marginTop: "16px" }}>
										責任者情報
									</Heading>
									<Field label="企画責任者">
										<Select.Root
											value={form.ownerId ?? ""}
											onValueChange={ownerId =>
												setForm(prev => ({ ...prev, ownerId }))
											}
										>
											<Select.Trigger />
											<Select.Content>
												{projectMembers.map(m => (
													<Select.Item key={m.userId} value={m.userId}>
														{m.name}
													</Select.Item>
												))}
											</Select.Content>
										</Select.Root>
									</Field>
									<Field label="副企画責任者">
										<Select.Root
											value={form.subOwnerId ?? "null"}
											onValueChange={subOwnerId =>
												setForm(prev => ({
													...prev,
													subOwnerId: subOwnerId === "null" ? null : subOwnerId,
												}))
											}
										>
											<Select.Trigger />
											<Select.Content>
												<Select.Item value="null">未設定</Select.Item>
												{projectMembers
													.filter(m => m.userId !== form.ownerId)
													.map(m => (
														<Select.Item key={m.userId} value={m.userId}>
															{m.name}
														</Select.Item>
													))}
											</Select.Content>
										</Select.Root>
									</Field>
								</>
							)}
						</div>
						<div className={styles.dialogActions}>
							<Dialog.Close>
								<Button variant="soft" color="gray" disabled={saving}>
									キャンセル
								</Button>
							</Dialog.Close>
							<Button onClick={handleSave} disabled={saving}>
								{saving ? "更新中..." : "更新する"}
							</Button>
						</div>
					</>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
}
