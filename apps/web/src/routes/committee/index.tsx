import { Heading, Link, Table, Text } from "@radix-ui/themes";
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router";
import { listCommitteeProjects } from "@/lib/api/committee-project";
import { useAuthStore } from "@/lib/auth";

function formatProjectNumberForUrl(projectNumber: number): string {
	return String(projectNumber).padStart(3, "0");
}

export const Route = createFileRoute("/committee/")({
	loader: async () => listCommitteeProjects({ limit: 20 }),
	component: CommitteeIndexPage,
	head: () => ({
		meta: [
			{ title: "委員会ダッシュボード | 雙峰祭オンラインシステム" },
			{ name: "description", content: "委員会ダッシュボード" },
		],
	}),
});

function CommitteeIndexPage() {
	const { user } = useAuthStore();
	const { projects } = Route.useLoaderData();

	return (
		<div>
			<Heading size="6">委員会ダッシュボード</Heading>
			<Text as="p" size="2" color="gray">
				ようこそ、{user?.name} さん
			</Text>

			<Heading size="4" style={{ marginTop: 16 }}>
				企画一覧
			</Heading>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.ColumnHeaderCell>企画番号</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>企画名</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>状態</Table.ColumnHeaderCell>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{projects.map(project => (
						<Table.Row key={project.id}>
							<Table.RowHeaderCell>{project.number}</Table.RowHeaderCell>
							<Table.Cell>
								<Link asChild>
									<RouterLink
										to="/committee/info/$projectId"
										params={{
											projectId: formatProjectNumberForUrl(project.number),
										}}
									>
										{project.name}
									</RouterLink>
								</Link>
							</Table.Cell>
							<Table.Cell>
								{project.deletionStatus === null ? "有効" : "停止"}
							</Table.Cell>
						</Table.Row>
					))}
				</Table.Body>
			</Table.Root>
		</div>
	);
}
