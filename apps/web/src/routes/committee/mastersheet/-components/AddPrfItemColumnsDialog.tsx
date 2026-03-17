import {
	Badge,
	Dialog,
	Checkbox as RadixCheckbox,
	Text,
} from "@radix-ui/themes";
import type {
	GetMastersheetDataResponse,
	ListProjectRegistrationFormsResponse,
	ProjectRegistrationFormItem,
} from "@sos26/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import { createMastersheetColumn } from "@/lib/api/committee-mastersheet";
import {
	getProjectRegistrationFormDetail,
	listProjectRegistrationForms,
} from "@/lib/api/committee-project-registration-form";
import { isClientError } from "@/lib/http/error";
import styles from "./AddFormItemColumnsDialog.module.scss";

type ApiColumn = GetMastersheetDataResponse["columns"][number];
type PrfForm = ListProjectRegistrationFormsResponse["forms"][number];

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

export function AddPrfItemColumnsDialog({
	open,
	onOpenChange,
	columns,
	onSuccess,
}: Props) {
	const [forms, setForms] = useState<PrfForm[]>([]);
	const [formsLoading, setFormsLoading] = useState(true);
	const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
	const [items, setItems] = useState<ProjectRegistrationFormItem[]>([]);
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
		listProjectRegistrationForms()
			.then(res => {
				// list API には collaborators が含まれないため、
				// 全申請を表示し、カラム作成時にバックエンドでアクセス権をチェックする
				setForms(res.forms);
			})
			.catch(() => toast.error("企画登録情報一覧の取得に失敗しました"))
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
		getProjectRegistrationFormDetail(selectedFormId)
			.then(res => setItems(res.form.items))
			.catch(() => toast.error("企画登録情報の詳細取得に失敗しました"))
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
						type: "PROJECT_REGISTRATION_FORM_ITEM",
						name: item.label,
						sortOrder: columns.length + i,
						projectRegistrationFormItemId: item.id,
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

	const existingPrfItemIds = new Set(
		columns.flatMap(c =>
			c.projectRegistrationFormItemId ? [c.projectRegistrationFormItemId] : []
		)
	);

	function renderItemRow(item: ProjectRegistrationFormItem) {
		const selected = selectedItemIds.has(item.id);
		const alreadyAdded = existingPrfItemIds.has(item.id);
		return (
			// biome-ignore lint/a11y/useSemanticElements: button cannot nest RadixCheckbox (which renders as button)
			<div
				key={item.id}
				role="button"
				tabIndex={alreadyAdded ? -1 : 0}
				className={`${styles.itemCard}${selected ? ` ${styles.itemCardSelected}` : ""}${alreadyAdded ? ` ${styles.itemCardDisabled}` : ""}`}
				onClick={() => !alreadyAdded && toggleItem(item.id)}
				onKeyDown={e => {
					if (!alreadyAdded && (e.key === "Enter" || e.key === " ")) {
						e.preventDefault();
						toggleItem(item.id);
					}
				}}
			>
				<RadixCheckbox
					size="2"
					checked={alreadyAdded || selected}
					disabled={alreadyAdded}
					onCheckedChange={() => !alreadyAdded && toggleItem(item.id)}
					aria-hidden="true"
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
			</div>
		);
	}

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="800px">
				<Dialog.Title>企画登録情報から情報を作成</Dialog.Title>

				<div className={styles.body}>
					{/* 左: 申請一覧 */}
					<div className={styles.left}>
						<Text size="2" weight="medium" className={styles.panelTitle}>
							企画登録情報一覧
						</Text>
						<div className={styles.formList}>
							{formsLoading ? (
								<Text size="2" color="gray">
									読み込み中...
								</Text>
							) : forms.length === 0 ? (
								<Text size="2" color="gray">
									申請がありません
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
									左で申請を選択してください
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
					<div className={styles.footerActions}>
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
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
