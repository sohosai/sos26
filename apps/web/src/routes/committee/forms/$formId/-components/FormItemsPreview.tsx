import { Text } from "@radix-ui/themes";
import { AnswerField } from "@/components/form/Answer/AnswerField";
import type { Form } from "@/components/form/type";
import styles from "./FormItemsPreview.module.scss";

type Props = {
	items: Form["items"];
};

export function FormItemsPreview({ items }: Props) {
	return (
		<ul className={styles.itemList}>
			{items.map(item => (
				<li key={item.id} className={styles.itemCard}>
					<Text size="2">{item.description}</Text>
					<AnswerField
						item={item}
						value={undefined}
						onChange={() => {}}
						disabled
					/>
				</li>
			))}
		</ul>
	);
}
