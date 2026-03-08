import {
	Badge,
	Popover,
	TextField as RadixTextField,
	Text,
} from "@radix-ui/themes";
import type {
	Bureau,
	MastersheetViewerInput,
	ViewerScope,
} from "@sos26/shared";
import { bureauLabelMap } from "@sos26/shared";
import { IconCheck, IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import { useState } from "react";
import styles from "./ViewerSelector.module.scss";

type UserSummary = { id: string; name: string };

const BUREAU_OPTIONS = Object.entries(bureauLabelMap).map(([value, label]) => ({
	value: value as Bureau,
	label,
}));

export function getScopeColor(scope: ViewerScope): "blue" | "orange" | "green" {
	if (scope === "ALL") return "blue";
	if (scope === "BUREAU") return "orange";
	return "green";
}

export function getViewerLabel(
	viewer: MastersheetViewerInput,
	members: UserSummary[]
): string {
	if (viewer.scope === "ALL") return "全員";
	if (viewer.scope === "BUREAU" && viewer.bureauValue) {
		return bureauLabelMap[viewer.bureauValue] ?? viewer.bureauValue;
	}
	if (viewer.scope === "INDIVIDUAL" && viewer.userId) {
		return members.find(m => m.id === viewer.userId)?.name ?? "不明";
	}
	return "不明";
}

type Props = {
	viewers: MastersheetViewerInput[];
	onChange: (viewers: MastersheetViewerInput[]) => void;
	committeeMembers: UserSummary[];
};

export function ViewerSelector({ viewers, onChange, committeeMembers }: Props) {
	const [addMode, setAddMode] = useState<"idle" | "BUREAU" | "INDIVIDUAL">(
		"idle"
	);
	const [searchQuery, setSearchQuery] = useState("");
	const hasAll = viewers.some(v => v.scope === "ALL");

	function handleSetAll() {
		onChange([{ scope: "ALL" }]);
	}

	function handleAddBureau(bureau: Bureau) {
		if (viewers.some(v => v.scope === "BUREAU" && v.bureauValue === bureau))
			return;
		onChange([
			...viewers.filter(v => v.scope !== "ALL"),
			{ scope: "BUREAU", bureauValue: bureau },
		]);
		setAddMode("idle");
	}

	function handleAddIndividual(userId: string) {
		if (viewers.some(v => v.scope === "INDIVIDUAL" && v.userId === userId))
			return;
		onChange([
			...viewers.filter(v => v.scope !== "ALL"),
			{ scope: "INDIVIDUAL", userId },
		]);
		setAddMode("idle");
		setSearchQuery("");
	}

	function handleRemove(index: number) {
		onChange(viewers.filter((_, i) => i !== index));
	}

	const filteredMembers = committeeMembers.filter(m => {
		const q = searchQuery.toLowerCase();
		return !q || m.name.toLowerCase().includes(q);
	});

	return (
		<div className={styles.container}>
			{viewers.length > 0 && (
				<div className={styles.viewers}>
					{viewers.map((v, i) => (
						<div
							key={`${v.scope}-${v.bureauValue ?? v.userId ?? "all"}`}
							className={styles.viewerChip}
						>
							<Badge size="1" variant="soft" color={getScopeColor(v.scope)}>
								{getViewerLabel(v, committeeMembers)}
							</Badge>
							<button
								type="button"
								className={styles.removeButton}
								onClick={() => handleRemove(i)}
								aria-label="削除"
							>
								<IconX size={10} />
							</button>
						</div>
					))}
				</div>
			)}

			{!hasAll && (
				<Popover.Root
					open={addMode !== "idle"}
					onOpenChange={open => {
						if (!open) {
							setAddMode("idle");
							setSearchQuery("");
						}
					}}
				>
					<div className={styles.actions}>
						<button
							type="button"
							className={styles.addButton}
							onClick={handleSetAll}
						>
							全体公開にする
						</button>
						<Popover.Trigger>
							<button
								type="button"
								className={styles.addButton}
								onClick={() => setAddMode("BUREAU")}
							>
								<IconPlus size={11} />
								局を追加
							</button>
						</Popover.Trigger>
						<Popover.Trigger>
							<button
								type="button"
								className={styles.addButton}
								onClick={() => setAddMode("INDIVIDUAL")}
							>
								<IconPlus size={11} />
								個人を追加
							</button>
						</Popover.Trigger>
					</div>

					<Popover.Content side="bottom" align="start">
						{addMode === "BUREAU" && (
							<div className={styles.popoverList}>
								{BUREAU_OPTIONS.map(opt => {
									const exists = viewers.some(
										v => v.scope === "BUREAU" && v.bureauValue === opt.value
									);
									return (
										<button
											key={opt.value}
											type="button"
											className={styles.popoverOption}
											onClick={() => handleAddBureau(opt.value)}
											disabled={exists}
										>
											<Text size="2">{opt.label}</Text>
											{exists && <IconCheck size={13} />}
										</button>
									);
								})}
							</div>
						)}

						{addMode === "INDIVIDUAL" && (
							<>
								<div className={styles.popoverSearch}>
									<RadixTextField.Root
										placeholder="検索..."
										size="2"
										value={searchQuery}
										onChange={e => setSearchQuery(e.target.value)}
									>
										<RadixTextField.Slot>
											<IconSearch size={13} />
										</RadixTextField.Slot>
									</RadixTextField.Root>
								</div>
								<div className={styles.popoverList}>
									{filteredMembers.length === 0 ? (
										<Text size="2" color="gray" className={styles.emptyText}>
											見つかりません
										</Text>
									) : (
										filteredMembers.map(m => {
											const exists = viewers.some(
												v => v.scope === "INDIVIDUAL" && v.userId === m.id
											);
											return (
												<button
													key={m.id}
													type="button"
													className={styles.popoverOption}
													onClick={() => handleAddIndividual(m.id)}
													disabled={exists}
												>
													<Text size="2">{m.name}</Text>
													{exists && <IconCheck size={13} />}
												</button>
											);
										})
									)}
								</div>
							</>
						)}
					</Popover.Content>
				</Popover.Root>
			)}

			{hasAll && (
				<Text size="1" color="blue">
					全ての実委人が閲覧可能です
				</Text>
			)}

			{viewers.length === 0 && (
				<Text size="1" color="gray">
					非公開（自分のみ閲覧可能）
				</Text>
			)}
		</div>
	);
}
