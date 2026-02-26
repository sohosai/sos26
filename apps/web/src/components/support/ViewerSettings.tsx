import {
	Badge,
	IconButton,
	Popover,
	TextField as RadixTextField,
	Text,
} from "@radix-ui/themes";
import type { Bureau, InquiryViewerScope } from "@sos26/shared";
import { bureauLabelMap } from "@sos26/shared";
import { IconCheck, IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useCallback, useState } from "react";
import styles from "./SupportDetail.module.scss";
import type { ViewerDetail, ViewerInput } from "./types";

const BUREAU_OPTIONS = Object.entries(bureauLabelMap).map(([value, label]) => ({
	value: value as Bureau,
	label,
}));

export function ViewerSettings({
	viewers,
	committeeMembers,
	onUpdate,
	readOnly = false,
}: {
	viewers: ViewerDetail[];
	committeeMembers: { id: string; name: string }[];
	onUpdate?: (viewers: ViewerInput[]) => Promise<void>;
	readOnly?: boolean;
}) {
	const [addMode, setAddMode] = useState<
		"idle" | "BUREAU" | "INDIVIDUAL" | null
	>("idle");
	const [memberSearchQuery, setMemberSearchQuery] = useState("");

	const hasAllScope = viewers.some(v => v.scope === "ALL");

	const viewersToInputs = useCallback(
		(list: ViewerDetail[]): ViewerInput[] =>
			list.map(v => ({
				scope: v.scope,
				...(v.scope === "BUREAU" && v.bureauValue
					? { bureauValue: v.bureauValue }
					: {}),
				...(v.scope === "INDIVIDUAL" && v.user ? { userId: v.user.id } : {}),
			})),
		[]
	);

	const handleSetAll = async () => {
		if (!onUpdate) return;
		await onUpdate([{ scope: "ALL" }]);
	};

	const handleRemoveViewer = async (viewerId: string) => {
		if (!onUpdate) return;
		const remaining = viewers.filter(v => v.id !== viewerId);
		await onUpdate(viewersToInputs(remaining));
	};

	const handleAddBureau = async (bureau: Bureau) => {
		if (!onUpdate) return;
		if (viewers.some(v => v.scope === "BUREAU" && v.bureauValue === bureau)) {
			return;
		}
		const inputs = [
			...viewersToInputs(viewers.filter(v => v.scope !== "ALL")),
			{ scope: "BUREAU" as const, bureauValue: bureau },
		];
		await onUpdate(inputs);
		setAddMode("idle");
	};

	const handleAddIndividual = async (userId: string) => {
		if (!onUpdate) return;
		if (viewers.some(v => v.scope === "INDIVIDUAL" && v.user?.id === userId)) {
			return;
		}
		const inputs = [
			...viewersToInputs(viewers.filter(v => v.scope !== "ALL")),
			{ scope: "INDIVIDUAL" as const, userId },
		];
		await onUpdate(inputs);
		setAddMode("idle");
		setMemberSearchQuery("");
	};

	const getViewerLabel = (viewer: ViewerDetail): string => {
		if (viewer.scope === "ALL") return "全員";
		if (viewer.scope === "BUREAU" && viewer.bureauValue) {
			return bureauLabelMap[viewer.bureauValue] ?? viewer.bureauValue;
		}
		if (viewer.scope === "INDIVIDUAL" && viewer.user) {
			return viewer.user.name;
		}
		return "不明";
	};

	const getScopeColor = (
		scope: InquiryViewerScope
	): "blue" | "orange" | "green" => {
		if (scope === "ALL") return "blue";
		if (scope === "BUREAU") return "orange";
		return "green";
	};

	return (
		<div className={styles.sidebarSection}>
			<div className={styles.sidebarSectionHeader}>
				<Text size="2" weight="medium" color="gray">
					閲覧者設定
				</Text>
			</div>

			{viewers.length === 0 ? (
				<Text size="1" color="gray">
					閲覧者が設定されていません
				</Text>
			) : (
				<div className={styles.viewerList}>
					{viewers.map(v => (
						<div key={v.id} className={styles.viewerItem}>
							<Badge size="1" variant="soft" color={getScopeColor(v.scope)}>
								{getViewerLabel(v)}
							</Badge>
							{!readOnly && (
								<IconButton
									variant="ghost"
									size="1"
									color="gray"
									onClick={() => handleRemoveViewer(v.id)}
								>
									<IconX size={12} />
								</IconButton>
							)}
						</div>
					))}
				</div>
			)}

			{!readOnly && !hasAllScope && (
				<Popover.Root
					open={addMode !== "idle" && addMode !== null}
					onOpenChange={o => {
						if (!o) {
							setAddMode("idle");
							setMemberSearchQuery("");
						}
					}}
				>
					<div className={styles.viewerActions}>
						<button
							type="button"
							className={styles.viewerAddButton}
							onClick={handleSetAll}
						>
							全体公開にする
						</button>
						<Popover.Trigger>
							<button
								type="button"
								className={styles.viewerAddButton}
								onClick={() => setAddMode("BUREAU")}
							>
								<IconPlus size={12} />
								局を追加
							</button>
						</Popover.Trigger>
						<Popover.Trigger>
							<button
								type="button"
								className={styles.viewerAddButton}
								onClick={() => setAddMode("INDIVIDUAL")}
							>
								<IconPlus size={12} />
								個人を追加
							</button>
						</Popover.Trigger>
					</div>

					<Popover.Content
						className={styles.assignPopover}
						side="bottom"
						align="start"
					>
						{addMode === "BUREAU" && (
							<div className={styles.assignList}>
								{BUREAU_OPTIONS.map(opt => {
									const exists = viewers.some(
										v => v.scope === "BUREAU" && v.bureauValue === opt.value
									);
									return (
										<button
											key={opt.value}
											type="button"
											className={`${styles.assignDropdownOption} ${exists ? styles.assignDropdownOptionSelected : ""}`}
											onClick={() => handleAddBureau(opt.value)}
											disabled={exists}
										>
											<Text size="2">{opt.label}</Text>
											{exists && (
												<IconCheck
													size={14}
													className={styles.assignDropdownOptionCheck}
												/>
											)}
										</button>
									);
								})}
							</div>
						)}
						{addMode === "INDIVIDUAL" && (
							<>
								<div className={styles.assignSearch}>
									<RadixTextField.Root
										placeholder="検索..."
										size="1"
										value={memberSearchQuery}
										onChange={e => setMemberSearchQuery(e.target.value)}
									>
										<RadixTextField.Slot>
											<IconSearch size={14} />
										</RadixTextField.Slot>
									</RadixTextField.Root>
								</div>
								<div className={styles.assignList}>
									{committeeMembers
										.filter(m => {
											const q = memberSearchQuery.toLowerCase();
											if (!q) return true;
											return m.name.toLowerCase().includes(q);
										})
										.map(m => {
											const exists = viewers.some(
												v => v.scope === "INDIVIDUAL" && v.user?.id === m.id
											);
											return (
												<button
													key={m.id}
													type="button"
													className={`${styles.assignDropdownOption} ${exists ? styles.assignDropdownOptionSelected : ""}`}
													onClick={() => handleAddIndividual(m.id)}
													disabled={exists}
												>
													<Avatar size={20} name={m.name} variant="beam" />
													<Text size="2">{m.name}</Text>
													{exists && (
														<IconCheck
															size={14}
															className={styles.assignDropdownOptionCheck}
														/>
													)}
												</button>
											);
										})}
								</div>
							</>
						)}
					</Popover.Content>
				</Popover.Root>
			)}

			{hasAllScope && (
				<Text size="1" color="blue">
					全ての実委人が閲覧可能です
				</Text>
			)}
		</div>
	);
}
