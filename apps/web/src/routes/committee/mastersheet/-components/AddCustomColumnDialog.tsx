import { Dialog, TextField as RadixTextField, Text } from "@radix-ui/themes";
import type {
	GetMastersheetDataResponse,
	MastersheetColumnVisibility,
	MastersheetDataType,
} from "@sos26/shared";
import { IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, IconButton, Select, TextField } from "@/components/primitives";
import { createMastersheetColumn } from "@/lib/api/committee-mastersheet";
import { isClientError } from "@/lib/http/error";
import styles from "./AddCustomColumnDialog.module.scss";

type ApiColumn = GetMastersheetDataResponse["columns"][number];

const DATA_TYPE_OPTIONS = [
	{ value: "TEXT", label: "テキスト" },
	{ value: "NUMBER", label: "数値" },
	{ value: "SELECT", label: "単一選択" },
	{ value: "MULTI_SELECT", label: "複数選択" },
];

const VISIBILITY_OPTIONS = [
	{ value: "PRIVATE", label: "非公開（自分のみ）" },
	{ value: "PUBLIC", label: "公開（全委員）" },
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
	const [visibility, setVisibility] = useState("PRIVATE");
	const [options, setOptions] = useState<OptionEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const nextId = useRef(0);

	const showOptions = dataType === "SELECT" || dataType === "MULTI_SELECT";

	function addOption() {
		setOptions(prev => [...prev, { id: nextId.current++, label: "" }]);
	}

	function removeOption(id: number) {
		setOptions(prev => prev.filter(o => o.id !== id));
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
			setVisibility("PRIVATE");
			setOptions([]);
		}
		onOpenChange(open);
	}

	async function handleSubmit() {
		if (!name.trim()) {
			toast.error("カラム名を入力してください");
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
				visibility: visibility as MastersheetColumnVisibility,
				options: optionsInput,
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
							onValueChange={setDataType}
						/>
					</div>
					<div className={styles.field}>
						<Text as="label" size="2" weight="medium">
							公開設定 *
						</Text>
						<Select
							options={VISIBILITY_OPTIONS}
							value={visibility}
							onValueChange={setVisibility}
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
