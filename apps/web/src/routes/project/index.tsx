import { Heading, Table, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	PROJECT_LOCATION_LABELS,
	PROJECT_TYPE_LABELS,
} from "@/lib/project/options";
import { useProject } from "@/lib/project/store";
import styles from "./index.module.scss";

export const Route = createFileRoute("/project/")({
	component: ProjectIndexPage,
	head: () => ({
		meta: [
			{ title: "企画ダッシュボード | 雙峰祭オンラインシステム" },
			{ name: "description", content: "企画ダッシュボード" },
		],
	}),
});

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
	return (
		<Table.Row>
			<Table.RowHeaderCell>{label}</Table.RowHeaderCell>
			<Table.Cell>{value}</Table.Cell>
		</Table.Row>
	);
}

function ProjectIndexPage() {
	const project = useProject();
	const rows = [
		{ label: "企画番号", value: project.number },
		{ label: "企画名", value: project.name },
		{ label: "企画名（ふりがな）", value: project.namePhonetic },
		{ label: "企画団体名", value: project.organizationName },
		{
			label: "企画団体名（ふりがな）",
			value: project.organizationNamePhonetic,
		},
		{
			label: "企画区分",
			value: PROJECT_TYPE_LABELS[project.type] ?? project.type,
		},
		{
			label: "実施場所",
			value: PROJECT_LOCATION_LABELS[project.location] ?? project.location,
		},
	];

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<Heading size="6">企画ダッシュボード</Heading>
				<Text as="p" size="2" color="gray">
					選択中の企画の基本情報を確認できます。
				</Text>
			</header>

			<Table.Root>
				<Table.Body>
					{rows.map(row => (
						<InfoRow key={row.label} label={row.label} value={row.value} />
					))}
				</Table.Body>
			</Table.Root>
		</div>
	);
}
