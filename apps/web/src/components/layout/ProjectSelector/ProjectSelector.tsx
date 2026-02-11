import { Popover, Separator, Text } from "@radix-ui/themes";
import {
	IconChevronDown,
	IconFolder,
	IconPlus,
	IconTicket,
} from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useState } from "react";
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
	onJoinProject: () => void;
};

export function ProjectSelector({
	projects,
	selectedProjectId,
	collapsed,
	onSelectProject,
	onCreateProject,
	onJoinProject,
}: ProjectSelectorProps) {
	const [open, setOpen] = useState(false);
	const selectedProject = projects.find(p => p.id === selectedProjectId);

	const handleSelectProject = (projectId: string) => {
		onSelectProject(projectId);
		setOpen(false);
	};

	const handleCreateProject = () => {
		onCreateProject();
		setOpen(false);
	};

	const handleJoinProject = () => {
		onJoinProject();
		setOpen(false);
	};

	const trigger = (
		<button type="button" className={styles.trigger}>
			<span className={styles.triggerIcon}>
				{selectedProject ? (
					<Avatar size={26} name={selectedProject.name} variant="beam" />
				) : (
					<IconFolder size={26} />
				)}
			</span>
			{!collapsed && (
				<>
					<Text size="2" truncate className={styles.triggerLabel}>
						{selectedProject ? selectedProject.name : "企画を選択"}
					</Text>
					<IconChevronDown size={14} className={styles.triggerChevron} />
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
					<button
						type="button"
						className={styles.actionItem}
						onClick={handleCreateProject}
					>
						<IconPlus size={16} />
						<Text size="2">新しい企画を作成</Text>
					</button>
					<button
						type="button"
						className={styles.actionItem}
						onClick={handleJoinProject}
					>
						<IconTicket size={16} />
						<Text size="2">招待コードで参加</Text>
					</button>
				</div>
			</Popover.Content>
		</Popover.Root>
	);
}
