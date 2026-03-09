import {
	Checkbox,
	Dialog,
	RadioGroup as RadixRadioGroup,
	TextField as RadixTextField,
	Text,
} from "@radix-ui/themes";
import type {
	GetMastersheetDataResponse,
	InitialValueInput,
	MastersheetDataType,
	MastersheetViewerInput,
} from "@sos26/shared";
import { IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, IconButton, Select, TextField } from "@/components/primitives";
import { createMastersheetColumn } from "@/lib/api/committee-mastersheet";
import { listCommitteeMembers } from "@/lib/api/committee-member";
import { isClientError } from "@/lib/http/error";
import styles from "./AddCustomColumnDialog.module.scss";
import { ViewerSelector } from "./ViewerSelector";

type ApiColumn = GetMastersheetDataResponse["columns"][number];

const DATA_TYPE_OPTIONS = [
	{ value: "TEXT", label: "テキスト" },
	{ value: "NUMBER", label: "数値" },
	{ value: "SELECT", label: "単一選択" },
	{ value: "MULTI_SELECT", label: "複数選択" },
];

type OptionEntry = { id: number; label: string };

function OptionRow({
	value,
	onChange,
	onRemove,
}: {
	value: string;
	onChange: (value: string) => void;
	onRemove: () => void;
}) {
	return (
		<div className={styles.optionRow}>
			<div className={styles.optionInput}>
				<RadixTextField.Root
					size="2"
					value={value}
					placeholder="選択肢のラベル"
					onChange={e => onChange(e.target.value)}
				/>
			</div>
			<IconButton aria-label="この選択肢を削除" size="1" onClick={onRemove}>
				<IconX size={14} />
			</IconButton>
		</div>
	);
}

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	columns: ApiColumn[];
	onSuccess: () => void;
};

export function AddCustomColumnDialog({
	open,
	onOpenChange,
	columns,
	onSuccess,
}: Props) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [dataType, setDataType] = useState("TEXT");
	const [viewers, setViewers] = useState<MastersheetViewerInput[]>([]);
	const [committeeMembers, setCommitteeMembers] = useState<
		{ id: string; name: string }[]
	>([]);
	const [options, setOptions] = useState<OptionEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const nextId = useRef(0);

	// 初期値
	const [initialText, setInitialText] = useState("");
	const [initialNumber, setInitialNumber] = useState("");
	// OptionEntry.id で管理（フィルタ後のインデックスずれを防ぐ）
	const [initialSelectedIds, setInitialSelectedIds] = useState<number[]>([]);

	useEffect(() => {
		if (!open) return;
		listCommitteeMembers()
			.then(res =>
				setCommitteeMembers(
					res.committeeMembers.map(m => ({ id: m.user.id, name: m.user.name }))
				)
			)
			.catch(() => toast.error("委員一覧の取得に失敗しました"));
	}, [open]);

	const showOptions = dataType === "SELECT" || dataType === "MULTI_SELECT";

	function addOption() {
		setOptions(prev => [...prev, { id: nextId.current++, label: "" }]);
	}

	function removeOption(id: number) {
		setOptions(prev => prev.filter(o => o.id !== id));
		setInitialSelectedIds(prev => prev.filter(i => i !== id));
	}

	function updateOption(id: number, value: string) {
		setOptions(prev =>
			prev.map(o => (o.id === id ? { ...o, label: value } : o))
		);
	}

	function handleClose(open: boolean) {
		if (!open) {
			setName("");
			setDescription("");
			setDataType("TEXT");
			setViewers([]);
			setOptions([]);
			setInitialText("");
			setInitialNumber("");
			setInitialSelectedIds([]);
		}
		onOpenChange(open);
	}

	function buildInitialValue(): InitialValueInput | undefined {
		if (dataType === "TEXT" && initialText.trim()) {
			return { textValue: initialText };
		}
		if (dataType === "NUMBER" && initialNumber.trim()) {
			const num = Number(initialNumber);
			if (!Number.isNaN(num)) return { numberValue: num };
		}
		if (showOptions && initialSelectedIds.length > 0) {
			// opt.id → フィルタ後のインデックスに変換
			const filtered = options.filter(o => o.label.trim());
			const indexes = initialSelectedIds
				.map(id => filtered.findIndex(o => o.id === id))
				.filter(i => i >= 0);
			if (indexes.length > 0) return { selectedOptionIndexes: indexes };
		}
		return undefined;
	}

	async function handleSubmit() {
		if (!name.trim()) {
			toast.error("カラム名を入力してください");
			return;
		}
		if (showOptions && options.filter(o => o.label.trim()).length === 0) {
			toast.error("選択肢を1つ以上追加してください");
			return;
		}
		setLoading(true);
		try {
			const optionsInput = showOptions
				? options
						.filter(o => o.label.trim())
						.map((o, i) => ({ label: o.label, sortOrder: i }))
				: undefined;

			await createMastersheetColumn({
				type: "CUSTOM",
				name: name.trim(),
				description: description.trim() || undefined,
				sortOrder: columns.length,
				dataType: dataType as MastersheetDataType,
				viewers,
				options: optionsInput,
				initialValue: buildInitialValue(),
			});
			toast.success("カラムを追加しました");
			onSuccess();
			handleClose(false);
		} catch (error) {
			toast.error(isClientError(error) ? error.message : "追加に失敗しました");
		} finally {
			setLoading(false);
		}
	}

	return (
		<Dialog.Root open={open} onOpenChange={handleClose}>
			<Dialog.Content maxWidth="480px">
				<Dialog.Title>カスタムカラムを追加</Dialog.Title>
				<div className={styles.form}>
					<TextField
						label="カラム名"
						value={name}
						onChange={setName}
						required
					/>
					<div className={styles.field}>
						<Text as="label" size="2" weight="medium">
							データ型 *
						</Text>
						<Select
							options={DATA_TYPE_OPTIONS}
							value={dataType}
							onValueChange={v => {
								setDataType(v);
								setInitialText("");
								setInitialNumber("");
								setInitialSelectedIds([]);
							}}
						/>
					</div>
					<div className={styles.field}>
						<Text size="2" weight="medium">
							アクセス権
						</Text>
						<ViewerSelector
							viewers={viewers}
							onChange={setViewers}
							committeeMembers={committeeMembers}
						/>
					</div>
					<TextField
						label="説明"
						value={description}
						onChange={setDescription}
					/>
					{showOptions && (
						<div className={styles.field}>
							<Text size="2" weight="medium">
								選択肢
							</Text>
							{options.map(opt => (
								<OptionRow
									key={opt.id}
									value={opt.label}
									onChange={v => updateOption(opt.id, v)}
									onRemove={() => removeOption(opt.id)}
								/>
							))}
							<Button intent="secondary" size="1" onClick={addOption}>
								+ 選択肢を追加
							</Button>
						</div>
					)}
					<div className={styles.field}>
						<Text size="2" weight="medium">
							初期値
						</Text>
						<Text size="1" color="gray">
							全企画のセルに一括で設定されます
						</Text>
						{dataType === "TEXT" && (
							<RadixTextField.Root
								size="2"
								value={initialText}
								placeholder="初期テキスト"
								onChange={e => setInitialText(e.target.value)}
							/>
						)}
						{dataType === "NUMBER" && (
							<RadixTextField.Root
								size="2"
								type="number"
								value={initialNumber}
								placeholder="初期数値"
								onChange={e => setInitialNumber(e.target.value)}
							/>
						)}
						{showOptions && (
							<div className={styles.initialOptions}>
								{dataType === "SELECT" ? (
									<RadixRadioGroup.Root
										size="1"
										variant="surface"
										value={
											initialSelectedIds.length > 0
												? String(initialSelectedIds[0])
												: ""
										}
										onValueChange={v => setInitialSelectedIds([Number(v)])}
									>
										{options
											.filter(o => o.label.trim())
											.map(opt => (
												<RadixRadioGroup.Item
													key={opt.id}
													value={String(opt.id)}
												>
													{opt.label}
												</RadixRadioGroup.Item>
											))}
									</RadixRadioGroup.Root>
								) : (
									options
										.filter(o => o.label.trim())
										.map(opt => {
											const checked = initialSelectedIds.includes(opt.id);
											return (
												<Text
													key={opt.id}
													as="label"
													size="2"
													className={styles.optionCheck}
												>
													<Checkbox
														size="1"
														checked={checked}
														onCheckedChange={v => {
															if (v === true) {
																setInitialSelectedIds(prev => [
																	...prev,
																	opt.id,
																]);
															} else {
																setInitialSelectedIds(prev =>
																	prev.filter(i => i !== opt.id)
																);
															}
														}}
													/>
													{opt.label}
												</Text>
											);
										})
								)}
								{options.filter(o => o.label.trim()).length === 0 && (
									<Text size="1" color="gray">
										選択肢を追加すると選べるようになります
									</Text>
								)}
							</div>
						)}
					</div>
					<div className={styles.actions}>
						<Button
							intent="secondary"
							size="2"
							onClick={() => handleClose(false)}
						>
							キャンセル
						</Button>
						<Button
							intent="primary"
							size="2"
							loading={loading}
							onClick={handleSubmit}
						>
							追加
						</Button>
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
