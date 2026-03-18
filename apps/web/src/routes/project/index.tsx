import { Heading, Table, Text } from "@radix-ui/themes";
import type { GetProjectRegistrationFormResponsesResponse } from "@sos26/shared";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { getProjectRegistrationFormResponses } from "@/lib/api/project";
import { formatDate, formatProjectNumber } from "@/lib/format";
import {
	PROJECT_LOCATION_LABELS,
	PROJECT_TYPE_LABELS,
} from "@/lib/project/options";
import { useProject, useProjectStore } from "@/lib/project/store";
import styles from "./index.module.scss";

export const Route = createFileRoute("/project/")({
	component: ProjectIndexPage,
	loader: async () => {
		const { selectedProjectId } = useProjectStore.getState();
		if (!selectedProjectId) {
			return { registrationFormResponses: [] };
		}

		const response =
			await getProjectRegistrationFormResponses(selectedProjectId);
		return { registrationFormResponses: response.responses };
	},
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
			<Table.RowHeaderCell className={styles.label}>
				{label}
			</Table.RowHeaderCell>
			<Table.Cell className={styles.value}>{value}</Table.Cell>
		</Table.Row>
	);
}

type RegistrationFormResponseAnswer =
	GetProjectRegistrationFormResponsesResponse["responses"][number]["answers"][number];

function formatAnswerValue(answer: RegistrationFormResponseAnswer): string {
	switch (answer.type) {
		case "TEXT":
		case "TEXTAREA":
			return answer.textValue ?? "未回答";
		case "NUMBER":
			return answer.numberValue !== null
				? String(answer.numberValue)
				: "未回答";
		case "SELECT":
		case "CHECKBOX":
			return answer.selectedOptions.length > 0
				? answer.selectedOptions.map(option => option.label).join("、")
				: "未回答";
		case "FILE":
			return answer.files.length > 0
				? `ファイル${answer.files.length}件`
				: "未回答";
		default: {
			return "不明な回答タイプ";
		}
	}
}

function ProjectIndexPage() {
	const project = useProject();
	const { registrationFormResponses } = Route.useLoaderData();
	const rows = [
		{ label: "企画番号", value: formatProjectNumber(project.number) },
		{ label: "登録日", value: formatDate(project.createdAt, "date") },
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

			<div className={styles.tableWrap}>
				<Table.Root className={styles.infoTable}>
					<Table.Body>
						{rows.map(row => (
							<InfoRow key={row.label} label={row.label} value={row.value} />
						))}
					</Table.Body>
				</Table.Root>
			</div>

			{registrationFormResponses.length > 0 && (
				<section className={styles.section}>
					<div className={styles.formResponses}>
						{registrationFormResponses.map(response => (
							<div key={response.id} className={styles.formResponseCard}>
								<Heading size="3">{response.form.title}</Heading>
								<div className={styles.tableWrap}>
									<Table.Root className={styles.infoTable}>
										<Table.Body>
											{response.answers.map(answer => (
												<Table.Row key={answer.formItemId}>
													<Table.RowHeaderCell className={styles.label}>
														{answer.formItemLabel}
													</Table.RowHeaderCell>
													<Table.Cell className={styles.value}>
														{formatAnswerValue(answer)}
													</Table.Cell>
												</Table.Row>
											))}
										</Table.Body>
									</Table.Root>
								</div>
							</div>
						))}
					</div>
				</section>
			)}
		</div>
	);
}
