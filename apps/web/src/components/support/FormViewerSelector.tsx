import {
	Badge,
	Popover,
	TextField as RadixTextField,
	Text,
} from "@radix-ui/themes";
import type { Bureau, InquiryViewerScope } from "@sos26/shared";
import { bureauLabelMap } from "@sos26/shared";
import { IconCheck, IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import Avatar from "boring-avatars";
import styles from "./NewInquiryForm.module.scss";

type ViewerInput = {
	scope: InquiryViewerScope;
	bureauValue?: Bureau;
	userId?: string;
};

type UserSummary = { id: string; name: string };

const BUREAU_OPTIONS = Object.entries(bureauLabelMap).map(([value, label]) => ({
	value: value as Bureau,
	label,
}));

export function FormViewerSelector({
	selectedViewers,
	onChangeViewers,
	committeeMembers,
	addMode,
	onAddModeChange,
	memberSearchQuery,
	onMemberSearchChange,
}: {
	selectedViewers: ViewerInput[];
	onChangeViewers: (viewers: ViewerInput[]) => void;
	committeeMembers: UserSummary[];
	addMode: "idle" | "BUREAU" | "INDIVIDUAL";
	onAddModeChange: (mode: "idle" | "BUREAU" | "INDIVIDUAL") => void;
	memberSearchQuery: string;
	onMemberSearchChange: (q: string) => void;
}) {
	const hasAllScope = selectedViewers.some(v => v.scope === "ALL");

	const handleSetAll = () => {
		onChangeViewers([{ scope: "ALL" }]);
	};

	const handleAddBureau = (bureau: Bureau) => {
		if (
			selectedViewers.some(
				v => v.scope === "BUREAU" && v.bureauValue === bureau
			)
		)
			return;
		onChangeViewers([
			...selectedViewers.filter(v => v.scope !== "ALL"),
			{ scope: "BUREAU", bureauValue: bureau },
		]);
		onAddModeChange("idle");
	};

	const handleAddIndividual = (userId: string) => {
		if (
			selectedViewers.some(v => v.scope === "INDIVIDUAL" && v.userId === userId)
		)
			return;
		onChangeViewers([
			...selectedViewers.filter(v => v.scope !== "ALL"),
			{ scope: "INDIVIDUAL", userId },
		]);
		onAddModeChange("idle");
		onMemberSearchChange("");
	};

	const handleRemoveViewer = (index: number) => {
		onChangeViewers(selectedViewers.filter((_, i) => i !== index));
	};

	const getViewerLabel = (viewer: ViewerInput): string => {
		if (viewer.scope === "ALL") return "全員";
		if (viewer.scope === "BUREAU" && viewer.bureauValue) {
			return bureauLabelMap[viewer.bureauValue] ?? viewer.bureauValue;
		}
		if (viewer.scope === "INDIVIDUAL" && viewer.userId) {
			const member = committeeMembers.find(m => m.id === viewer.userId);
			return member?.name ?? "不明";
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
		<div className={styles.assignSection}>
			<Text size="2" weight="medium">
				閲覧者設定（任意）
			</Text>
			<Text size="1" color="gray">
				担当者以外に閲覧を許可する場合に設定してください
			</Text>

			{selectedViewers.length === 0 ? (
				<Text size="1" color="gray">
					閲覧者が設定されていません
				</Text>
			) : (
				<div className={styles.viewerList}>
					{selectedViewers.map((v, i) => (
						<div
							key={`${v.scope}-${v.bureauValue ?? v.userId ?? "all"}`}
							className={styles.viewerItem}
						>
							<Badge size="1" variant="soft" color={getScopeColor(v.scope)}>
								{getViewerLabel(v)}
							</Badge>
							<button
								type="button"
								className={styles.viewerItemRemove}
								onClick={() => handleRemoveViewer(i)}
							>
								<IconX size={12} />
							</button>
						</div>
					))}
				</div>
			)}

			{!hasAllScope && (
				<Popover.Root
					open={addMode !== "idle"}
					onOpenChange={o => {
						if (!o) {
							onAddModeChange("idle");
							onMemberSearchChange("");
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
								onClick={() => onAddModeChange("BUREAU")}
							>
								<IconPlus size={12} />
								局を追加
							</button>
						</Popover.Trigger>
						<Popover.Trigger>
							<button
								type="button"
								className={styles.viewerAddButton}
								onClick={() => onAddModeChange("INDIVIDUAL")}
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
									const exists = selectedViewers.some(
										v => v.scope === "BUREAU" && v.bureauValue === opt.value
									);
									return (
										<button
											key={opt.value}
											type="button"
											className={`${styles.assignOption} ${exists ? styles.assignOptionSelected : ""}`}
											onClick={() => handleAddBureau(opt.value)}
											disabled={exists}
										>
											<Text size="2">{opt.label}</Text>
											{exists && (
												<IconCheck
													size={14}
													className={styles.assignOptionCheck}
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
										size="2"
										value={memberSearchQuery}
										onChange={e => onMemberSearchChange(e.target.value)}
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
											const exists = selectedViewers.some(
												v => v.scope === "INDIVIDUAL" && v.userId === m.id
											);
											return (
												<button
													key={m.id}
													type="button"
													className={`${styles.assignOption} ${exists ? styles.assignOptionSelected : ""}`}
													onClick={() => handleAddIndividual(m.id)}
													disabled={exists}
												>
													<Avatar size={20} name={m.name} variant="beam" />
													<Text size="2">{m.name}</Text>
													{exists && (
														<IconCheck
															size={14}
															className={styles.assignOptionCheck}
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
