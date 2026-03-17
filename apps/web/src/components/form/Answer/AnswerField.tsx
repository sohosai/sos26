import { Flex, Text } from "@radix-ui/themes";
import {
	CheckboxGroup,
	CheckboxGroupItem,
} from "@/components/patterns/CheckboxGroup";
import { RadioGroup, RadioGroupItem } from "@/components/patterns/RadioGroup";
import { TextArea, TextField } from "@/components/primitives";
import { FileUploadFieldWithPreview } from "../EachField/FileUploadFieldWithPreview";
import { NumberField } from "../EachField/NumberField";
import {
	createEmptyFileAnswerValue,
	type FormAnswerValue,
	type FormItem,
	isFileAnswerValue,
} from "../type";

type FieldProps = {
	item: FormItem;
	value: FormAnswerValue | undefined;
	onChange: (val: FormAnswerValue) => void;
	disabled?: boolean;
};

export function AnswerField({ item, value, onChange, disabled }: FieldProps) {
	const label = (
		<Text size="2" weight="medium">
			{item.label + (item.required ? " *" : "")}
		</Text>
	);
	const description = item.description ? (
		<Text size="1" color="gray">
			{item.description}
		</Text>
	) : null;

	const constraints = item.constraints;
	const textValue = typeof value === "string" ? value : "";
	const charCount = textValue.length;
	const maxLength = constraints?.maxLength;

	const charCounter =
		(item.type === "TEXT" || item.type === "TEXTAREA") && maxLength ? (
			<Text
				size="1"
				color={charCount > maxLength ? "red" : "gray"}
				style={{ textAlign: "right" }}
			>
				{charCount} / {maxLength}
			</Text>
		) : null;

	const field = (() => {
		switch (item.type) {
			case "TEXT":
				return (
					<TextField
						label=""
						placeholder="回答を入力してください"
						value={(value as string) ?? ""}
						onChange={value => onChange(value)}
						disabled={disabled}
						aria-label={item.label}
					/>
				);

			case "TEXTAREA":
				return (
					<TextArea
						label=""
						value={(value as string) ?? ""}
						onChange={value => onChange(value)}
						placeholder="回答を入力してください"
						rows={3}
						resize="none"
						autoGrow
						disabled={disabled}
						aria-label={item.label}
					/>
				);

			case "NUMBER":
				return (
					<NumberField
						label=""
						value={value as number | null}
						onChange={onChange}
						disabled={disabled}
						aria-label={item.label}
					/>
				);

			case "FILE": {
				const fileValue = isFileAnswerValue(value)
					? value
					: createEmptyFileAnswerValue();
				return (
					<FileUploadFieldWithPreview
						label=""
						value={fileValue.pendingFiles}
						uploadedFiles={fileValue.uploadedFiles}
						onChange={files =>
							onChange({
								pendingFiles: files,
								uploadedFiles: files.length > 0 ? [] : fileValue.uploadedFiles,
							})
						}
						disabled={disabled}
						aria-label={item.label}
					/>
				);
			}

			case "SELECT":
				return (
					<RadioGroup
						label=""
						value={(value as string) ?? ""}
						onValueChange={val => onChange(val)}
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
				);

			case "CHECKBOX":
				return (
					<CheckboxGroup
						label=""
						value={(value as string[]) ?? []}
						onValueChange={val => onChange(val)}
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
				);

			default:
				return null;
		}
	})();

	return (
		<Flex direction="column" gap="1">
			{label}
			{description}
			{field}
			{charCounter}
		</Flex>
	);
}
