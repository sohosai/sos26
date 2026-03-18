import { Heading, Separator, Text } from "@radix-ui/themes";
import { IconArrowLeft } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnswerField } from "@/components/form/Answer/AnswerField";
import { DownloadFileNameProvider } from "@/components/form/Answer/DownloadFileNameContext";
import { EditableAnswerItem } from "@/components/form/Answer/EditableAnswerItem";
import { getFormDetail, getFormResponse } from "@/lib/api/committee-form";
import { useAuthStore } from "@/lib/auth";
import { formDetailToForm } from "@/lib/form/convert";
import { responseToAnswers } from "@/lib/form/utils";
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
		const [formRes, responseRes] = await Promise.all([
			getFormDetail(params.formId),
			getFormResponse(params.formId, params.answerId),
		]);

		const form = formDetailToForm(formRes);
		const answers = responseToAnswers(responseRes.response, form);

		return {
			formDetail: formRes,
			form,
			response: responseRes.response,
			answers,
		};
	},
});

function RouteComponent() {
	const { formId } = Route.useParams();
	const { formDetail, form, response, answers } = Route.useLoaderData();
	const { user } = useAuthStore();
	const canEditAnswers =
		formDetail.form.ownerId === user?.id ||
		formDetail.form.collaborators.some(
			c => c.user.id === user?.id && c.isWrite
		);
	const downloadFileNameContext = {
		projectNumber: response.project.number,
		formTitle: form.name,
		projectName: response.project.name,
	};

	return (
		<DownloadFileNameProvider value={downloadFileNameContext}>
			<div className={styles.page}>
				<Link
					to="/committee/forms/$formId/answers"
					params={{ formId }}
					className={styles.backLink}
				>
					<IconArrowLeft size={16} />
					<Text size="2">回答一覧に戻る</Text>
				</Link>

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
						<li key={item.id}>
							{canEditAnswers ? (
								<EditableAnswerItem
									item={item}
									initialValue={answers[item.id]}
									formId={formId}
									projectId={response.project.id}
								/>
							) : (
								<AnswerField
									item={item}
									value={answers[item.id]}
									onChange={() => {}}
									disabled
								/>
							)}
						</li>
					))}
				</ul>
			</div>
		</DownloadFileNameProvider>
	);
}
