import { Badge, Dialog, Text } from "@radix-ui/themes";
import type { DiscoverMastersheetColumnsResponse } from "@sos26/shared";
import { IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, IconButton } from "@/components/primitives";
import {
	createMastersheetAccessRequest,
	discoverMastersheetColumns,
} from "@/lib/api/committee-mastersheet";
import { isClientError } from "@/lib/http/error";
import styles from "./ColumnDiscoverDialog.module.scss";

type DiscoverColumn = DiscoverMastersheetColumnsResponse["columns"][number];

// ─────────────────────────────────────────────────────────────
// カラム行
// ─────────────────────────────────────────────────────────────

type DiscoverColumnItemProps = {
	col: DiscoverColumn;
	requesting: boolean;
	onRequest: () => void;
};

function DiscoverColumnItem({
	col,
	requesting,
	onRequest,
}: DiscoverColumnItemProps) {
	return (
		<div className={styles.listItem}>
			<div className={styles.listItemInfo}>
				<div className={styles.listItemName}>
					<Text size="2" weight="medium" truncate>
						{col.name}
					</Text>
					<Badge
						size="1"
						color={
							col.type === "FORM_ITEM"
								? "blue"
								: col.type === "PROJECT_REGISTRATION_FORM_ITEM"
									? "teal"
									: "gray"
						}
					>
						{col.type === "FORM_ITEM"
							? "申請"
							: col.type === "PROJECT_REGISTRATION_FORM_ITEM"
								? "企画登録情報"
								: "カスタム"}
					</Badge>
				</div>
				<Text size="1" color="gray">
					{col.createdByName}
				</Text>
				{col.description && (
					<Text size="1" color="gray" truncate>
						{col.description}
					</Text>
				)}
			</div>
			<div className={styles.listItemStatus}>
				{col.hasAccess ? (
					<Badge color="green">表示中</Badge>
				) : col.pendingRequest ? (
					<Badge color="orange">申請中</Badge>
				) : (
					<Button
						size="1"
						intent="secondary"
						loading={requesting}
						onClick={onRequest}
					>
						アクセス申請
					</Button>
				)}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// メインダイアログ
// ─────────────────────────────────────────────────────────────

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function ColumnDiscoverDialog({ open, onOpenChange }: Props) {
	const [columns, setColumns] = useState<DiscoverColumn[]>([]);
	const [loading, setLoading] = useState(false);
	const [requesting, setRequesting] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (!open) return;
		setLoading(true);
		discoverMastersheetColumns()
			.then(res => setColumns(res.columns))
			.catch(() => toast.error("カラム一覧の取得に失敗しました"))
			.finally(() => setLoading(false));
	}, [open]);

	async function handleRequest(columnId: string) {
		setRequesting(prev => new Set(prev).add(columnId));
		try {
			await createMastersheetAccessRequest(columnId);
			toast.success("アクセス申請を送信しました");
			setColumns(prev =>
				prev.map(c => (c.id === columnId ? { ...c, pendingRequest: true } : c))
			);
		} catch (error) {
			toast.error(isClientError(error) ? error.message : "申請に失敗しました");
		} finally {
			setRequesting(prev => {
				const next = new Set(prev);
				next.delete(columnId);
				return next;
			});
		}
	}

	function renderContent() {
		if (loading) {
			return (
				<Text size="2" color="gray">
					読み込み中...
				</Text>
			);
		}
		if (columns.length === 0) {
			return (
				<div className={styles.emptyState}>
					<Text size="2" color="gray">
						公開カラムがありません
					</Text>
				</div>
			);
		}
		return columns.map(col => (
			<DiscoverColumnItem
				key={col.id}
				col={col}
				requesting={requesting.has(col.id)}
				onRequest={() => handleRequest(col.id)}
			/>
		));
	}

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="480px">
				<div className={styles.header}>
					<Dialog.Title mb="0">カラムを探す</Dialog.Title>
					<IconButton aria-label="閉じる" onClick={() => onOpenChange(false)}>
						<IconX size={16} />
					</IconButton>
				</div>
				<Dialog.Description size="2" mb="3">
					他のユーザーが公開しているカラムにアクセス申請を送ることができます。
				</Dialog.Description>
				{renderContent()}
			</Dialog.Content>
		</Dialog.Root>
	);
}
