import { Popover, Separator, Text } from "@radix-ui/themes";
import {
	IconChevronDown,
	IconFolder,
	IconPlus,
	IconTicket,
} from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useEffect, useRef, useState } from "react";
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
	applicationPeriodInfo?: {
		isOpen: boolean;
		periods: { start: string; end: string }[] | null;
	} | null;
};

export function ProjectSelector({
	projects,
	selectedProjectId,
	collapsed,
	onSelectProject,
	onCreateProject,
	onJoinProject,
	hasPrivilegedProject,
	applicationPeriodInfo,
}: ProjectSelectorProps) {
	const [open, setOpen] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const [showJoinInput, setShowJoinInput] = useState(false);
	const [inviteCode, setInviteCode] = useState("");
	const joinInputContainerRef = useRef<HTMLDivElement>(null);
	const selectedProject = projects.find(p => p.id === selectedProjectId);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const mediaQuery = window.matchMedia("(max-width: 900px)");
		const handleMediaChange = () => {
			setIsMobile(mediaQuery.matches);
		};

		handleMediaChange();
		mediaQuery.addEventListener("change", handleMediaChange);

		return () => mediaQuery.removeEventListener("change", handleMediaChange);
	}, []);

	useEffect(() => {
		if (!showJoinInput) return;
		const timer = requestAnimationFrame(() => {
			joinInputContainerRef.current?.querySelector("input")?.focus();
		});
		return () => cancelAnimationFrame(timer);
	}, [showJoinInput]);

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
			<Popover.Content
				side={isMobile ? "bottom" : "right"}
				align={isMobile ? "center" : "start"}
				className={`${styles.content} ${isMobile ? styles.mobileContent : ""}`}
			>
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
					{/* 企画責任者、副企画責任者でなければ */}
					{!hasPrivilegedProject && (
						<button
							type="button"
							className={styles.actionItem}
							onClick={handleCreateProject}
							disabled={applicationPeriodInfo?.isOpen === false}
							style={
								applicationPeriodInfo && !applicationPeriodInfo.isOpen
									? {
											opacity: 0.5,
											cursor: "not-allowed",
											flexDirection: "column",
											alignItems: "flex-start",
										}
									: undefined
							}
						>
							<div
								style={{ display: "flex", alignItems: "center", gap: "8px" }}
							>
								<IconPlus size={16} />
								<Text size="2">新しい企画を作成</Text>
							</div>
							{applicationPeriodInfo && !applicationPeriodInfo.isOpen && (
								<Text size="1" color="gray" style={{ marginLeft: "24px" }}>
									（現在、応募期間外です）
								</Text>
							)}
						</button>
					)}

					{!showJoinInput ? (
						<button
							type="button"
							className={styles.actionItem}
							onClick={() => setShowJoinInput(true)}
						>
							<IconTicket size={16} />
							<Text size="2">企画参加コードで参加</Text>
						</button>
					) : (
						<div className={styles.joinInput} ref={joinInputContainerRef}>
							<TextField
								placeholder="企画参加コードを入力"
								value={inviteCode}
								onChange={(value: string) => setInviteCode(value)}
								label={""}
								aria-label="企画参加コード入力"
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
