import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { listFormResponses } from "@/lib/api/committee-form";

export const Route = createFileRoute(
	"/committee/forms/$formId/answers/$answerId/"
)({
	component: RouteComponent,
	loader: async ({ params }) => {
		const res = await listFormResponses(params.formId);
		const answer = res.responses.find(r => r.id === params.answerId);
		if (!answer) throw new Error("Not found");

		return { answer };
	},
});

function RouteComponent() {
	const { answer } = Route.useLoaderData();

	return (
		<div>
			<Heading size="5">回答詳細</Heading>

			<div style={{ marginTop: 16 }}>
				<Text size="2" color="gray">
					回答者
				</Text>
				<Text size="3">{answer.respondent.name}</Text>
			</div>

			<div style={{ marginTop: 24 }}>
				{answer.answers.map(a => (
					<div key={a.formItemId} style={{ marginBottom: 20 }}>
						<Text size="2" weight="medium">
							{a.formItemId}
						</Text>

						{a.textValue && <Text>{a.textValue}</Text>}
						{a.numberValue != null && <Text>{a.numberValue}</Text>}
						{a.selectedOptions.length > 0 && (
							<Text>{a.selectedOptions.map(o => o.label).join(", ")}</Text>
						)}
						{a.fileUrl && (
							<a href={a.fileUrl} target="_blank" rel="noreferrer">
								<Text color="blue">ファイルを開く</Text>
							</a>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
