import { Flex } from "@radix-ui/themes";
import type { FormItemType } from "@sos26/shared";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import { editFormAnswer } from "@/lib/api/committee-form";
import { isClientError } from "@/lib/http/error";
import type { FormAnswerValue, FormItem } from "../type";
import { isFileAnswerValue } from "../type";
import { AnswerField } from "./AnswerField";

function buildEditPayload(
	type: FormItemType,
	value: FormAnswerValue
): Parameters<typeof editFormAnswer>[3] {
	switch (type) {
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
	const [saving, setSaving] = useState(false);

	const isDirty = value !== savedValue;

	const handleSave = useCallback(async () => {
		if (saving || value === undefined) return;

		setSaving(true);
		try {
			const payload = buildEditPayload(
				item.type.toUpperCase() as FormItemType,
				value
			);
			await editFormAnswer(formId, item.id, projectId, payload);
			setSavedValue(value);
			toast.success("回答を保存しました");
		} catch (error) {
			toast.error(
				isClientError(error) ? error.message : "回答の更新に失敗しました"
			);
		} finally {
			setSaving(false);
		}
	}, [formId, item.id, item.type, projectId, value, saving]);

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
