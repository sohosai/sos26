import { Heading, Separator, Text } from "@radix-ui/themes";
import { IconArrowLeft } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnswerField } from "@/components/form/Answer/AnswerField";
import { formDetailToForm } from "@/components/form/convert";
import { getFormDetail, listFormResponses } from "@/lib/api/committee-form";
import { responseToAnswers } from "@/lib/form";
import { formatDate } from "@/lib/format";
import styles from "./index.module.scss";

export const Route = createFileRoute(
	"/committee/forms/$formId/answers/$answerId/"
)({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "回答詳細 | 雙峰祭オンラインシステム" }],
	}),

	loader: async ({ params }) => {
		const [formRes, responsesRes] = await Promise.all([
			getFormDetail(params.formId),
			listFormResponses(params.formId),
		]);

		const response = responsesRes.responses.find(r => r.id === params.answerId);
		if (!response) throw new Error("回答が見つかりません");

		const form = formDetailToForm(formRes);
		const answers = responseToAnswers(response, form);

		return { form, response, answers };
	},
});

function RouteComponent() {
	const { formId } = Route.useParams();
	const { form, response, answers } = Route.useLoaderData();
	const navigate = useNavigate();

	return (
		<div className={styles.page}>
			<button
				type="button"
				className={styles.backLink}
				onClick={() =>
					navigate({
						to: "/committee/forms/$formId/answers",
						params: { formId },
					})
				}
			>
				<IconArrowLeft size={16} />
				<Text size="2">回答一覧に戻る</Text>
			</button>

			<header className={styles.header}>
				<Heading size="5">{form.name}</Heading>
				<div className={styles.meta}>
					<Text size="2" color="gray">
						企画: {response.project.name}
					</Text>
					<Text size="2" color="gray">
						提出日時:{" "}
						{response.submittedAt
							? formatDate(response.submittedAt, "datetime")
							: "—"}
					</Text>
				</div>
				{form.description && (
					<Text size="2" color="gray">
						{form.description}
					</Text>
				)}
			</header>

			<Separator size="4" />

			<ul className={styles.itemList}>
				{form.items.map(item => (
					<li key={item.id} className={styles.itemCard}>
						<AnswerField
							item={item}
							value={answers[item.id]}
							onChange={() => {}}
							disabled
						/>
					</li>
				))}
			</ul>
		</div>
	);
}
