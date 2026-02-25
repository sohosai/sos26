import { Text } from "@radix-ui/themes";
import {
	CheckboxGroup,
	CheckboxGroupItem,
} from "@/components/patterns/CheckboxGroup";
import { RadioGroup, RadioGroupItem } from "@/components/patterns/RadioGroup";
import { TextArea, TextField } from "@/components/primitives";
import { FileUploadField } from "../EachField/FileUploadField";
import { NumberField } from "../EachField/NumberField";
import type { FormAnswerValue, FormItem } from "../type";

type FieldProps = {
	item: FormItem;
	value: FormAnswerValue | undefined;
	onChange: (val: FormAnswerValue) => void;
	disabled?: boolean;
};

export function AnswerField({ item, value, onChange, disabled }: FieldProps) {
	const Label = () => <Text size="2">{item.label}</Text>;
	const Description = () => <Text size="1">{item.description}</Text>;
	switch (item.type) {
		case "TEXT":
			return (
				<>
					<Label />
					<Description />
					<TextField
						label=""
						placeholder="回答を入力してください"
						value={(value as string) ?? ""}
						onChange={value => onChange(value)}
						required={item.required}
						disabled={disabled}
						aria-label={item.label}
					/>
				</>
			);

		case "TEXTAREA":
			return (
				<>
					<Label />
					<Description />
					<TextArea
						label=""
						value={(value as string) ?? ""}
						onChange={value => onChange(value)}
						placeholder="回答を入力してください"
						rows={3}
						required={item.required}
						resize="none"
						autoGrow
						disabled={disabled}
						aria-label={item.label}
					/>
				</>
			);

		case "NUMBER":
			return (
				<>
					<Label />
					<Description />
					<NumberField
						label=""
						value={value as number | null}
						onChange={onChange}
						required={item.required}
						disabled={disabled}
						aria-label={item.label}
						// 必要になったら有効化
						// allowDecimal // 小数許可
						// allowNegative // 負の数許可
					/>
				</>
			);

		case "FILE":
			return (
				<>
					<Label />
					<Description />
					<FileUploadField
						label=""
						value={value as File | null}
						onChange={onChange}
						required={item.required}
						disabled={disabled}
						aria-label={item.label}
					/>
				</>
			);

		case "SELECT":
			return (
				<>
					<Label />
					<Description />
					<RadioGroup
						label=""
						value={(value as string) ?? ""}
						onValueChange={val => onChange(val)}
						required={item.required}
						name={item.id}
						disabled={disabled}
						aria-label={item.label}
					>
						{(item.options ?? []).map(option => (
							<RadioGroupItem key={option.id} value={option.id}>
								{option.label}
							</RadioGroupItem>
						))}
					</RadioGroup>
				</>
			);

		case "CHECKBOX":
			return (
				<>
					<Label />
					<Description />
					<CheckboxGroup
						label=""
						value={(value as string[]) ?? []}
						onValueChange={val => onChange(val)}
						required={item.required}
						name={item.id}
						disabled={disabled}
						aria-label={item.label}
					>
						{(item.options ?? []).map(option => (
							<CheckboxGroupItem key={option.id} value={option.id}>
								{option.label}
							</CheckboxGroupItem>
						))}
					</CheckboxGroup>
				</>
			);

		default:
			return null;
	}
}
