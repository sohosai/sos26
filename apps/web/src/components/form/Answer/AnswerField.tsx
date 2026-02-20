import {
	CheckboxGroup,
	CheckboxGroupItem,
} from "@/components/patterns/CheckboxGroup";
import { RadioGroup, RadioGroupItem } from "@/components/patterns/RadioGroup";
import { TextArea, TextField } from "@/components/primitives";
import { FileUploadFieldWithPreview } from "../EachField/FileUploadFieldWithPreview";
import { NumberField } from "../EachField/NumberField";
import type { FormAnswerValue, FormItem } from "../type";

type FieldProps = {
	item: FormItem;
	value: FormAnswerValue | undefined;
	onChange: (val: FormAnswerValue) => void;
};

export function AnswerField({ item, value, onChange }: FieldProps) {
	switch (item.type) {
		case "text":
			return (
				<TextField
					label={item.label}
					placeholder="回答を入力してください"
					value={(value as string) ?? ""}
					onChange={value => onChange(value)}
					required={item.required}
				/>
			);

		case "textarea":
			return (
				<TextArea
					label={item.label}
					value={(value as string) ?? ""}
					onChange={value => onChange(value)}
					placeholder="回答を入力してください"
					rows={3}
					required={item.required}
					resize="none"
					autoGrow
				/>
			);

		case "number":
			return (
				<NumberField
					label={item.label}
					value={value as number | null}
					onChange={onChange}
					required={item.required}
					// 必要になったら有効化
					// allowDecimal // 小数許可
					// allowNegative // 負の数許可
				/>
			);

		case "file":
			return (
				// <FileUploadField
				// 	label={item.label}
				// 	value={value as File | null}
				// 	onChange={onChange}
				// 	required={item.required}
				// />
				<FileUploadFieldWithPreview
					label={item.label}
					value={value as File | null}
					onChange={onChange}
					required={item.required}
				/>
			);

		case "select":
			return (
				<RadioGroup
					label={item.label}
					value={(value as string) ?? ""}
					onValueChange={val => onChange(val)}
					required={item.required}
					name={item.id}
				>
					{(item.options ?? []).map(option => (
						<RadioGroupItem key={option.id} value={option.id}>
							{option.label}
						</RadioGroupItem>
					))}
				</RadioGroup>
			);

		case "checkbox":
			return (
				<CheckboxGroup
					label={item.label}
					value={(value as string[]) ?? []}
					onValueChange={val => onChange(val)}
					required={item.required}
					name={item.id}
				>
					{(item.options ?? []).map(option => (
						<CheckboxGroupItem key={option.id} value={option.id}>
							{option.label}
						</CheckboxGroupItem>
					))}
				</CheckboxGroup>
			);

		default:
			return null;
	}
}
