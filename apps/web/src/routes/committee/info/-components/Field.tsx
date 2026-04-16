import { Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import styles from "../$projectId.module.scss";

export function Field({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className={styles.field}>
			<Text size="2">{label}</Text>
			{children}
		</div>
	);
}
