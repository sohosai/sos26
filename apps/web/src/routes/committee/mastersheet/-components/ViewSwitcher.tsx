import { Flex, Popover, Separator, Text, TextField } from "@radix-ui/themes";
import type { ListMastersheetViewsResponse } from "@sos26/shared";
import { IconBookmark, IconTrash } from "@tabler/icons-react";
import type { SortingState, VisibilityState } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, IconButton } from "@/components/primitives";
import {
	createMastersheetView,
	deleteMastersheetView,
	listMastersheetViews,
} from "@/lib/api/committee-mastersheet";
import styles from "./ViewSwitcher.module.scss";

export type ViewState = {
	sorting?: SortingState;
	columnVisibility?: VisibilityState;
};

type Props = {
	currentState: ViewState;
	onApply: (state: ViewState) => void;
};

type SavedView = ListMastersheetViewsResponse["views"][number];

export function ViewSwitcher({ currentState, onApply }: Props) {
	const [open, setOpen] = useState(false);
	const [views, setViews] = useState<SavedView[]>([]);
	const [loading, setLoading] = useState(false);
	const [saveName, setSaveName] = useState("");
	const [saving, setSaving] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setLoading(true);
		listMastersheetViews()
			.then(res => setViews(res.views))
			.catch(() => toast.error("ビューの取得に失敗しました"))
			.finally(() => setLoading(false));
	}, [open]);

	async function handleSave() {
		const name = saveName.trim();
		if (!name) return;
		setSaving(true);
		try {
			const state = JSON.stringify(currentState);
			const res = await createMastersheetView({ name, state });
			setViews(prev => [...prev, res.view]);
			setSaveName("");
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
			setViews(prev => prev.filter(v => v.id !== viewId));
		} catch {
			toast.error("ビューの削除に失敗しました");
		} finally {
			setDeletingId(null);
		}
	}

	function handleApply(view: SavedView) {
		try {
			const state = JSON.parse(view.state) as ViewState;
			onApply(state);
			setOpen(false);
		} catch {
			toast.error("ビューの適用に失敗しました");
		}
	}

	function renderViews() {
		if (loading) {
			return (
				<Text size="2" color="gray">
					読み込み中...
				</Text>
			);
		}
		if (views.length === 0) {
			return (
				<div className={styles.emptyState}>
					<Text size="2" color="gray">
						保存済みビューがありません
					</Text>
				</div>
			);
		}
		return (
			<div className={styles.list}>
				{views.map(view => (
					<div key={view.id} className={styles.viewItem}>
						<Text size="2" truncate className={styles.viewName}>
							{view.name}
						</Text>
						<Flex gap="1" flexShrink="0">
							<Button
								size="1"
								intent="secondary"
								onClick={() => handleApply(view)}
							>
								適用
							</Button>
							<IconButton
								aria-label="削除"
								size="1"
								disabled={deletingId === view.id}
								onClick={() => handleDelete(view.id)}
							>
								<IconTrash size={14} />
							</IconButton>
						</Flex>
					</div>
				))}
			</div>
		);
	}

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger>
				<Button intent="secondary">
					<IconBookmark size={16} /> ビュー
				</Button>
			</Popover.Trigger>
			<Popover.Content style={{ width: 280 }}>
				<div className={styles.saveSection}>
					<TextField.Root
						placeholder="ビュー名を入力"
						value={saveName}
						onChange={e => setSaveName(e.target.value)}
						onKeyDown={e => e.key === "Enter" && handleSave()}
						style={{ flex: 1 }}
					/>
					<Button
						intent="primary"
						size="2"
						loading={saving}
						disabled={!saveName.trim()}
						onClick={handleSave}
					>
						保存
					</Button>
				</div>
				<Separator size="4" my="3" />
				{renderViews()}
			</Popover.Content>
		</Popover.Root>
	);
}
