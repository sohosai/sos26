import {
	Badge,
	Dialog,
	Flex,
	Checkbox as RadixCheckbox,
	Text,
} from "@radix-ui/themes";
import type {
	FormItem,
	GetMastersheetDataResponse,
	ListMyFormsResponse,
} from "@sos26/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import { getFormDetail, listMyForms } from "@/lib/api/committee-form";
import { createMastersheetColumn } from "@/lib/api/committee-mastersheet";
import { isClientError } from "@/lib/http/error";
import styles from "./AddFormItemColumnsDialog.module.scss";

type ApiColumn = GetMastersheetDataResponse["columns"][number];
type Form = ListMyFormsResponse["forms"][number];

const FORM_ITEM_TYPE_LABEL: Record<string, string> = {
	TEXT: "テキスト",
	TEXTAREA: "テキストエリア",
	SELECT: "単一選択",
	CHECKBOX: "チェック",
	NUMBER: "数値",
	FILE: "ファイル",
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	columns: ApiColumn[];
	onSuccess: () => void;
};

export function AddFormItemColumnsDialog({
	open,
	onOpenChange,
	columns,
	onSuccess,
}: Props) {
	const [forms, setForms] = useState<Form[]>([]);
	const [formsLoading, setFormsLoading] = useState(true);
	const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
	const [items, setItems] = useState<FormItem[]>([]);
	const [itemsLoading, setItemsLoading] = useState(false);
	const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
		new Set()
	);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!open) return;
		setForms([]);
		setFormsLoading(true);
		setSelectedFormId(null);
		setItems([]);
		setSelectedItemIds(new Set());
		listMyForms()
			.then(res => setForms(res.forms))
			.catch(() => toast.error("フォーム一覧の取得に失敗しました"))
			.finally(() => setFormsLoading(false));
	}, [open]);

	useEffect(() => {
		if (!selectedFormId) {
			setItems([]);
			return;
		}
		setItemsLoading(true);
		setItems([]);
		setSelectedItemIds(new Set());
		getFormDetail(selectedFormId)
			.then(res => setItems(res.form.items))
			.catch(() => toast.error("フォームの詳細取得に失敗しました"))
			.finally(() => setItemsLoading(false));
	}, [selectedFormId]);

	function toggleItem(itemId: string) {
		setSelectedItemIds(prev => {
			const next = new Set(prev);
			if (next.has(itemId)) {
				next.delete(itemId);
			} else {
				next.add(itemId);
			}
			return next;
		});
	}

	async function handleSubmit() {
		const selected = items.filter(i => selectedItemIds.has(i.id));
		if (selected.length === 0) return;
		setLoading(true);
		try {
			await Promise.all(
				selected.map((item, i) =>
					createMastersheetColumn({
						type: "FORM_ITEM",
						name: item.label,
						sortOrder: columns.length + i,
						formItemId: item.id,
					})
				)
			);
			toast.success(`${selected.length}件のカラムを追加しました`);
			onSuccess();
			onOpenChange(false);
		} catch (error) {
			toast.error(isClientError(error) ? error.message : "追加に失敗しました");
		} finally {
			setLoading(false);
		}
	}

	const existingFormItemIds = new Set(
		columns.flatMap(c => (c.formItemId ? [c.formItemId] : []))
	);

	function renderItemRow(item: FormItem) {
		const selected = selectedItemIds.has(item.id);
		const alreadyAdded = existingFormItemIds.has(item.id);
		return (
			<button
				key={item.id}
				type="button"
				className={`${styles.itemCard}${selected ? ` ${styles.itemCardSelected}` : ""}${alreadyAdded ? ` ${styles.itemCardDisabled}` : ""}`}
				onClick={() => !alreadyAdded && toggleItem(item.id)}
				disabled={alreadyAdded}
			>
				<RadixCheckbox
					size="2"
					checked={alreadyAdded || selected}
					disabled={alreadyAdded}
					onCheckedChange={() => !alreadyAdded && toggleItem(item.id)}
				/>
				<div className={styles.itemInfo}>
					<Text size="2" truncate>
						{item.label}
					</Text>
					<Badge size="1" color="gray">
						{FORM_ITEM_TYPE_LABEL[item.type] ?? item.type}
					</Badge>
					{alreadyAdded && (
						<Badge size="1" color="green">
							追加済み
						</Badge>
					)}
				</div>
			</button>
		);
	}

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="800px">
				<Dialog.Title>フォームから情報を作成</Dialog.Title>

				<div className={styles.body}>
					{/* 左: フォーム一覧 */}
					<div className={styles.left}>
						<Text size="2" weight="medium" className={styles.panelTitle}>
							フォーム一覧
						</Text>
						<div className={styles.formList}>
							{formsLoading ? (
								<Text size="2" color="gray">
									読み込み中...
								</Text>
							) : forms.length === 0 ? (
								<Text size="2" color="gray">
									フォームがありません
								</Text>
							) : (
								forms.map(form => (
									<button
										key={form.id}
										type="button"
										className={`${styles.formCard}${selectedFormId === form.id ? ` ${styles.formCardSelected}` : ""}`}
										onClick={() => setSelectedFormId(form.id)}
									>
										<Text
											size="2"
											weight={selectedFormId === form.id ? "medium" : "regular"}
											truncate
										>
											{form.title}
										</Text>
										{form.description && (
											<Text size="1" color="gray" truncate>
												{form.description}
											</Text>
										)}
									</button>
								))
							)}
						</div>
					</div>

					{/* 右: 質問を選択 */}
					<div className={styles.right}>
						<Text size="2" weight="medium" className={styles.panelTitle}>
							質問を選択
						</Text>
						<div className={styles.itemList}>
							{!selectedFormId ? (
								<Text size="2" color="gray">
									左でフォームを選択してください
								</Text>
							) : itemsLoading ? (
								<Text size="2" color="gray">
									読み込み中...
								</Text>
							) : items.length === 0 ? (
								<Text size="2" color="gray">
									質問がありません
								</Text>
							) : (
								items.map(renderItemRow)
							)}
						</div>
					</div>
				</div>

				{/* フッター */}
				<div className={styles.footer}>
					<Text size="2" color="gray">
						{selectedItemIds.size}件の質問を選択中
					</Text>
					<Flex gap="2">
						<Button
							intent="secondary"
							size="2"
							onClick={() => onOpenChange(false)}
						>
							キャンセル
						</Button>
						<Button
							intent="primary"
							size="2"
							loading={loading}
							disabled={selectedItemIds.size === 0}
							onClick={handleSubmit}
						>
							カラムを作成
						</Button>
					</Flex>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
