import { Flex } from "@radix-ui/themes";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import { editFormAnswer } from "@/lib/api/committee-form";
import { isClientError } from "@/lib/http/error";
import type { FormAnswerValue, FormItem } from "../type";
import { isFileAnswerValue } from "../type";
import { AnswerField } from "./AnswerField";

function buildEditPayload(
	item: FormItem,
	value: FormAnswerValue
): Parameters<typeof editFormAnswer>[3] {
	switch (item.type) {
		case "SELECT":
			return {
				selectedOptionIds: typeof value === "string" && value ? [value] : [],
			};
		case "CHECKBOX":
			return {
				selectedOptionIds: Array.isArray(value) ? (value as string[]) : [],
			};
		case "NUMBER":
			return {
				numberValue: typeof value === "number" ? value : null,
			};
		case "FILE":
			return {
				fileIds: isFileAnswerValue(value)
					? value.uploadedFiles.map(f => f.id)
					: [],
			};
		default:
			return {
				textValue: typeof value === "string" ? value : null,
			};
	}
}

function serializeValue(value: FormAnswerValue | undefined): string {
	if (value === undefined || value === null) return "";
	if (typeof value === "string" || typeof value === "number")
		return String(value);
	if (Array.isArray(value)) return JSON.stringify(value);
	if (isFileAnswerValue(value))
		return JSON.stringify(value.uploadedFiles.map(f => f.id));
	return JSON.stringify(value);
}

type Props = {
	item: FormItem;
	initialValue: FormAnswerValue | undefined;
	formId: string;
	projectId: string;
};

export function EditableAnswerItem({
	item,
	initialValue,
	formId,
	projectId,
}: Props) {
	const [value, setValue] = useState<FormAnswerValue | undefined>(initialValue);
	const [savedValue, setSavedValue] = useState<FormAnswerValue | undefined>(
		initialValue
	);
	const savedSerializedRef = useRef(serializeValue(initialValue));
	const [saving, setSaving] = useState(false);

	const isDirty = serializeValue(value) !== savedSerializedRef.current;

	const handleSave = useCallback(async () => {
		if (saving || value === undefined) return;

		setSaving(true);
		try {
			const payload = buildEditPayload(item, value);
			await editFormAnswer(formId, item.id, projectId, payload);
			setSavedValue(value);
			savedSerializedRef.current = serializeValue(value);
			toast.success("回答を保存しました");
		} catch (error) {
			toast.error(
				isClientError(error) ? error.message : "回答の更新に失敗しました"
			);
		} finally {
			setSaving(false);
		}
	}, [formId, item, projectId, value, saving]);

	const handleCancel = useCallback(() => {
		setValue(savedValue);
	}, [savedValue]);

	return (
		<Flex direction="column" gap="2">
			<AnswerField item={item} value={value} onChange={setValue} />
			{isDirty && (
				<Flex gap="2" justify="end">
					<Button
						intent="secondary"
						size="1"
						onClick={handleCancel}
						disabled={saving}
					>
						キャンセル
					</Button>
					<Button size="1" onClick={handleSave} loading={saving}>
						保存
					</Button>
				</Flex>
			)}
		</Flex>
	);
}
