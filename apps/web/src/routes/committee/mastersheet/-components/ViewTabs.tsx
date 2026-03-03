import { DropdownMenu } from "@radix-ui/themes";
import type { ListMastersheetViewsResponse } from "@sos26/shared";
import { IconDotsVertical, IconPlus } from "@tabler/icons-react";
import type {
	ColumnFiltersState,
	SortingState,
	VisibilityState,
} from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	createMastersheetView,
	deleteMastersheetView,
	listMastersheetViews,
	updateMastersheetView,
} from "@/lib/api/committee-mastersheet";
import styles from "./ViewTabs.module.scss";

export type ViewState = {
	sorting?: SortingState;
	/** カラムごとの表示/非表示（明示的に設定されたもののみ） */
	columnVisibility?: VisibilityState;
	/** このビューを保存した時点で存在していたカラムID一覧。未収録のカラムは非表示扱い */
	knownColumnIds?: string[];
	columnFilters?: ColumnFiltersState;
};

type SavedView = ListMastersheetViewsResponse["views"][number];

type Props = {
	activeViewId: string | null;
	currentState: ViewState;
	onSelectView: (viewId: string, state: ViewState) => void;
	onActiveViewIdChange: (viewId: string) => void;
};

function nextViewName(views: SavedView[]): string {
	const nums = views
		.map(v => {
			const m = v.name.match(/^ビュー(\d+)$/);
			return m?.[1] ? Number.parseInt(m[1], 10) : 0;
		})
		.filter(n => n > 0);
	const max = nums.length > 0 ? Math.max(...nums) : 0;
	return `ビュー${max + 1}`;
}

export function ViewTabs({
	activeViewId,
	currentState,
	onSelectView,
	onActiveViewIdChange,
}: Props) {
	const [views, setViews] = useState<SavedView[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	// Escape キーで blur ハンドラをスキップするためのフラグ
	const escapeRef = useRef(false);
	const renameInputRef = useRef<HTMLInputElement>(null);

	// リネーム開始時に input をフォーカス
	useEffect(() => {
		if (editingId) renameInputRef.current?.focus();
	}, [editingId]);

	const viewsRef = useRef<SavedView[]>([]);
	useEffect(() => {
		viewsRef.current = views;
	}, [views]);

	// 初期ロード：ビューがなければ「ビュー1」を自動作成し、最初のビューを適用
	// biome-ignore lint/correctness/useExhaustiveDependencies: 初回のみ実行。各コールバックとinitialStateはマウント時点の値で十分
	useEffect(() => {
		const initialState = currentState;
		listMastersheetViews()
			.then(async res => {
				if (res.views.length === 0) {
					const created = await createMastersheetView({
						name: "ビュー1",
						state: JSON.stringify(initialState),
					});
					setViews([created.view]);
					onSelectView(created.view.id, initialState);
					onActiveViewIdChange(created.view.id);
				} else {
					setViews(res.views);
					const first = res.views[0];
					if (first) {
						const state = JSON.parse(first.state) as ViewState;
						onSelectView(first.id, state);
						onActiveViewIdChange(first.id);
					}
				}
			})
			.catch(() => toast.error("ビューの取得に失敗しました"));
	}, []);

	// アクティブビューへの自動保存（1秒デバウンス）
	const currentStateStr = JSON.stringify(currentState);
	useEffect(() => {
		if (!activeViewId) return;
		const savedView = viewsRef.current.find(v => v.id === activeViewId);
		if (!savedView || currentStateStr === savedView.state) return;

		const timer = setTimeout(async () => {
			const sv = viewsRef.current.find(v => v.id === activeViewId);
			if (!sv || currentStateStr === sv.state) return;
			try {
				const res = await updateMastersheetView(sv.id, {
					state: currentStateStr,
				});
				setViews(prev => prev.map(v => (v.id === sv.id ? res.view : v)));
			} catch {
				toast.error("自動保存に失敗しました");
			}
		}, 1000);

		return () => clearTimeout(timer);
	}, [currentStateStr, activeViewId]);

	const activeView =
		activeViewId !== null ? views.find(v => v.id === activeViewId) : undefined;

	const isDirty =
		activeView !== undefined && currentStateStr !== activeView.state;

	async function handleAddView() {
		const name = nextViewName(viewsRef.current);
		try {
			const res = await createMastersheetView({ name, state: currentStateStr });
			setViews(prev => [...prev, res.view]);
			onSelectView(res.view.id, JSON.parse(res.view.state) as ViewState);
			onActiveViewIdChange(res.view.id);
		} catch {
			toast.error("ビューの追加に失敗しました");
		}
	}

	async function handleDelete(viewId: string) {
		try {
			await deleteMastersheetView(viewId);
			const remaining = views.filter(v => v.id !== viewId);

			if (remaining.length === 0) {
				const res = await createMastersheetView({
					name: "ビュー1",
					state: JSON.stringify(currentState),
				});
				setViews([res.view]);
				onSelectView(res.view.id, currentState);
				onActiveViewIdChange(res.view.id);
			} else {
				setViews(remaining);
				if (activeViewId === viewId) {
					const first = remaining[0];
					if (first) {
						const state = JSON.parse(first.state) as ViewState;
						onSelectView(first.id, state);
						onActiveViewIdChange(first.id);
					}
				}
			}
		} catch {
			toast.error("ビューの削除に失敗しました");
		}
	}

	async function handleRename(viewId: string) {
		if (escapeRef.current) {
			escapeRef.current = false;
			return;
		}
		const name = editingName.trim();
		setEditingId(null);
		if (!name) return;
		const sv = views.find(v => v.id === viewId);
		if (!sv || name === sv.name) return;
		try {
			const res = await updateMastersheetView(viewId, { name });
			setViews(prev => prev.map(v => (v.id === viewId ? res.view : v)));
		} catch {
			toast.error("名前の変更に失敗しました");
		}
	}

	function handleSelectView(view: SavedView) {
		if (view.id === activeViewId) return;
		try {
			const state = JSON.parse(view.state) as ViewState;
			onSelectView(view.id, state);
		} catch {
			toast.error("ビューの適用に失敗しました");
		}
	}

	return (
		<div className={styles.viewTabs}>
			{views.map(view => {
				const isActive = view.id === activeViewId;
				const isThisDirty = isActive && isDirty;
				const isEditing = editingId === view.id;
				return (
					<div
						key={view.id}
						className={`${styles.tabWrapper} ${isActive ? styles.activeWrapper : ""}`}
					>
						{isEditing ? (
							<input
								ref={renameInputRef}
								className={styles.renameInput}
								value={editingName}
								onChange={e => setEditingName(e.target.value)}
								onKeyDown={e => {
									if (e.key === "Enter" && !e.nativeEvent.isComposing)
										handleRename(view.id);
									if (e.key === "Escape") {
										escapeRef.current = true;
										setEditingId(null);
									}
								}}
								onBlur={() => handleRename(view.id)}
							/>
						) : (
							<button
								type="button"
								className={styles.tab}
								onClick={() => handleSelectView(view)}
							>
								{view.name}
								{isThisDirty && (
									<span className={styles.dirtyMark} title="自動保存待ち">
										*
									</span>
								)}
							</button>
						)}

						{!isEditing && (
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									<button
										type="button"
										className={styles.menuBtn}
										aria-label={`${view.name}のメニュー`}
									>
										<IconDotsVertical size={14} />
									</button>
								</DropdownMenu.Trigger>
								<DropdownMenu.Content size="2">
									<DropdownMenu.Item
										onClick={() => {
											setEditingId(view.id);
											setEditingName(view.name);
											escapeRef.current = false;
										}}
									>
										名前を変更
									</DropdownMenu.Item>
									<DropdownMenu.Separator />
									<DropdownMenu.Item
										color="red"
										onClick={() => handleDelete(view.id)}
									>
										削除
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						)}
					</div>
				);
			})}

			<button
				type="button"
				className={styles.addBtn}
				onClick={handleAddView}
				aria-label="新規ビューを追加"
			>
				<IconPlus size={13} />
			</button>
		</div>
	);
}
