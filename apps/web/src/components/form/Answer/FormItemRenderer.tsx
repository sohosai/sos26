// import { Select, TextArea, TextField } from "@radix-ui/themes";
// import type { FormItem } from "../type";

// type FormItemValue =
//   | string
//   | number
//   | boolean
//   | string[]
//   | File
//   | File[]
//   | null;

// type Props = {
// 	item: FormItem;
// 	value: FormItemValue;
// 	onChange: (value: any) => void;
// };

// export function FormItemRenderer({ item, value, onChange }: Props) {
// 	switch (item.type) {
// 		case "text":
// 			return (
// 				<TextField.Root
// 					value={value}
// 					onChange={e => onChange(e.target.value)}
// 				/>
// 			);

// 		case "textarea":
// 			return (
// 				<TextArea value={value} onChange={e => onChange(e.target.value)} />
// 			);

// 		case "select":
// 			return (
// 				<Select.Root value={value} onValueChange={onChange}>
// 					<Select.Trigger />
// 					<Select.Content>
// 						{item.options?.map(opt => (
// 							<Select.Item key={opt} value={opt}>
// 								{opt}
// 							</Select.Item>
// 						))}
// 					</Select.Content>
// 				</Select.Root>
// 			);

// 		case "checkbox":
// 			return (
// 				<div>
// 					{item.options?.map(opt => (
// 						<label key={opt}>
// 							<input
// 								type="checkbox"
// 								checked={value?.includes(opt)}
// 								onChange={() => {
// 									/* toggle */
// 								}}
// 							/>
// 							{opt}
// 						</label>
// 					))}
// 				</div>
// 			);

// 		case "number":
// 			return (
// 				<TextField.Root
// 					type="number"
// 					value={value}
// 					onChange={e => onChange(e.target.value)}
// 				/>
// 			);

// 		case "file":
// 			return <input type="file" onChange={e => onChange(e.target.files)} />;

// 		default:
// 			return null;
// 	}
// }
