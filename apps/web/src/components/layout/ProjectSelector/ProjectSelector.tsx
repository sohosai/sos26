import { Popover, Separator, Text } from "@radix-ui/themes";
import {
	IconChevronDown,
	IconFolder,
	IconPlus,
	IconTicket,
} from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useState } from "react";
import { Button, TextField } from "@/components/primitives";
import styles from "./ProjectSelector.module.scss";

export type Project = {
	id: string;
	name: string;
};

type ProjectSelectorProps = {
	projects: Project[];
	selectedProjectId: string | null;
	collapsed: boolean;
	onSelectProject: (projectId: string) => void;
	onCreateProject: () => void;
	onJoinProject: (inviteCode: string) => void;
	hasPrivilegedProject: boolean;
};

export function ProjectSelector({
	projects,
	selectedProjectId,
	collapsed,
	onSelectProject,
	onCreateProject,
	onJoinProject,
	hasPrivilegedProject,
}: ProjectSelectorProps) {
	const [open, setOpen] = useState(false);
	const [showJoinInput, setShowJoinInput] = useState(false);
	const [inviteCode, setInviteCode] = useState("");
	const selectedProject = projects.find(p => p.id === selectedProjectId);

	const handleSelectProject = (projectId: string) => {
		onSelectProject(projectId);
		setOpen(false);
	};

	const handleCreateProject = () => {
		onCreateProject();
		setOpen(false);
	};
	const handleSubmitJoin = () => {
		if (!inviteCode.trim()) return;

		onJoinProject(inviteCode.trim());

		setInviteCode("");
		setShowJoinInput(false);
		setOpen(false);
	};
	const handleCancelJoin = () => {
		setInviteCode("");
		setShowJoinInput(false);
	};

	const trigger = (
		<button
			type="button"
			className={`${styles.trigger} ${collapsed ? styles.collapsed : ""}`}
		>
			<span className={styles.icon}>
				{selectedProject ? (
					<Avatar size={26} name={selectedProject.name} variant="beam" />
				) : (
					<IconFolder size={26} />
				)}
			</span>
			{!collapsed && (
				<>
					<Text size="2" truncate className={styles.label}>
						{selectedProject ? selectedProject.name : "企画を選択"}
					</Text>
					<IconChevronDown size={14} className={styles.chevron} />
				</>
			)}
		</button>
	);

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger>{trigger}</Popover.Trigger>
			<Popover.Content side="right" align="start" className={styles.content}>
				{projects.length > 0 && (
					<>
						<Text size="1" color="gray" className={styles.sectionLabel}>
							あなたの企画
						</Text>
						<div className={styles.projectList}>
							{projects.map(project => (
								<button
									key={project.id}
									type="button"
									className={`${styles.projectItem} ${project.id === selectedProjectId ? styles.selected : ""}`}
									onClick={() => handleSelectProject(project.id)}
								>
									<Avatar size={28} name={project.name} variant="beam" />
									<Text size="2" truncate>
										{project.name}
									</Text>
								</button>
							))}
						</div>
						<Separator size="4" />
					</>
				)}
				<div className={styles.actions}>
					{/* 責任者、副責任者でなければ */}
					{!hasPrivilegedProject && (
						<button
							type="button"
							className={styles.actionItem}
							onClick={handleCreateProject}
						>
							<IconPlus size={16} />
							<Text size="2">新しい企画を作成</Text>
						</button>
					)}

					{!showJoinInput ? (
						<button
							type="button"
							className={styles.actionItem}
							onClick={() => setShowJoinInput(true)}
						>
							<IconTicket size={16} />
							<Text size="2">招待コードで参加</Text>
						</button>
					) : (
						<div className={styles.joinInput}>
							<TextField
								placeholder="招待コードを入力"
								value={inviteCode}
								onChange={(value: string) => setInviteCode(value)}
								label={""}
								aria-label="招待コード入力"
							/>
							<div className={styles.joinActions}>
								<Button intent="secondary" onClick={handleCancelJoin}>
									キャンセル
								</Button>
								<Button
									disabled={!inviteCode.trim()}
									onClick={handleSubmitJoin}
								>
									参加
								</Button>
							</div>
						</div>
					)}
				</div>
			</Popover.Content>
		</Popover.Root>
	);
}
