import { TextField as RadixTextField } from "@radix-ui/themes";
import type { ListMastersheetViewsResponse } from "@sos26/shared";
import { IconPlus, IconX } from "@tabler/icons-react";
import type { SortingState, VisibilityState } from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import {
	createMastersheetView,
	deleteMastersheetView,
	listMastersheetViews,
} from "@/lib/api/committee-mastersheet";
import styles from "./ViewTabs.module.scss";

export type ViewState = {
	sorting?: SortingState;
	/** カラムごとの表示/非表示（明示的に設定されたもののみ） */
	columnVisibility?: VisibilityState;
	/** このビューを保存した時点で存在していたカラムID一覧。未収録のカラムは非表示扱い */
	knownColumnIds?: string[];
};

type SavedView = ListMastersheetViewsResponse["views"][number];

type Props = {
	activeViewId: string | null;
	currentState: ViewState;
	onSelectView: (viewId: string, state: ViewState) => void;
	onActiveViewIdChange: (viewId: string) => void;
};

export function ViewTabs({
	activeViewId,
	currentState,
	onSelectView,
	onActiveViewIdChange,
}: Props) {
	const [views, setViews] = useState<SavedView[]>([]);
	const [addMode, setAddMode] = useState(false);
	const [saveName, setSaveName] = useState("");
	const [saving, setSaving] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const viewsRef = useRef<SavedView[]>([]);
	useEffect(() => {
		viewsRef.current = views;
	}, [views]);

	// 初期ロード：ビューがなければ「ビュー1」を自動作成し、最初のビューを適用
	// biome-ignore lint/correctness/useExhaustiveDependencies: 初回のみ実行。各コールバックとinitialStateはマウント時点の値で十分
	useEffect(() => {
		// マウント時点の currentState を使って初期ビューを作成する
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
				await deleteMastersheetView(sv.id);
				const res = await createMastersheetView({
					name: sv.name,
					state: currentStateStr,
				});
				setViews(prev => prev.filter(v => v.id !== sv.id).concat(res.view));
				onActiveViewIdChange(res.view.id);
			} catch {
				toast.error("自動保存に失敗しました");
			}
		}, 1000);

		return () => clearTimeout(timer);
	}, [currentStateStr, activeViewId, onActiveViewIdChange]);

	const activeView =
		activeViewId !== null ? views.find(v => v.id === activeViewId) : undefined;

	const isDirty =
		activeView !== undefined && currentStateStr !== activeView.state;

	async function handleSaveNew() {
		const name = saveName.trim();
		if (!name) return;
		setSaving(true);
		try {
			const res = await createMastersheetView({ name, state: currentStateStr });
			setViews(prev => [...prev, res.view]);
			setSaveName("");
			setAddMode(false);
			onSelectView(res.view.id, JSON.parse(res.view.state) as ViewState);
			onActiveViewIdChange(res.view.id);
			toast.success("ビューを保存しました");
		} catch {
			toast.error("ビューの保存に失敗しました");
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(viewId: string) {
		setDeletingId(viewId);
		try {
			await deleteMastersheetView(viewId);
			const remaining = views.filter(v => v.id !== viewId);

			if (remaining.length === 0) {
				// 最後のビューを削除したら「ビュー1」を再作成（現在の状態を引き継ぐ）
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
					// 削除したビューがアクティブだったら最初のビューへ移動
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
		} finally {
			setDeletingId(null);
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
				return (
					<div
						key={view.id}
						className={`${styles.tabWrapper} ${isActive ? styles.activeWrapper : ""}`}
					>
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
						<button
							type="button"
							className={styles.deleteBtn}
							aria-label={`${view.name}を削除`}
							disabled={deletingId === view.id}
							onClick={() => handleDelete(view.id)}
						>
							<IconX size={10} />
						</button>
					</div>
				);
			})}

			{/* 新規ビュー追加 */}
			{addMode ? (
				<div className={styles.addForm}>
					<RadixTextField.Root
						size="1"
						placeholder="ビュー名"
						value={saveName}
						autoFocus
						onChange={e => setSaveName(e.target.value)}
						onKeyDown={e => {
							if (e.key === "Enter") handleSaveNew();
							if (e.key === "Escape") {
								setAddMode(false);
								setSaveName("");
							}
						}}
						style={{ width: 120 }}
					/>
					<Button
						size="1"
						intent="primary"
						loading={saving}
						disabled={!saveName.trim()}
						onClick={handleSaveNew}
					>
						保存
					</Button>
					<Button
						size="1"
						intent="secondary"
						onClick={() => {
							setAddMode(false);
							setSaveName("");
						}}
					>
						キャンセル
					</Button>
				</div>
			) : (
				<button
					type="button"
					className={styles.addBtn}
					onClick={() => setAddMode(true)}
					aria-label="新規ビューを追加"
				>
					<IconPlus size={13} />
				</button>
			)}
		</div>
	);
}
