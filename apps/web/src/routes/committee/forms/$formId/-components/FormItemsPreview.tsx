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
					<AnswerField item={item} value={undefined} onChange={() => {}} />
				</li>
			))}
		</ul>
	);
}
